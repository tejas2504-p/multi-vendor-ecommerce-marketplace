import { Types } from 'mongoose';
import {
  Order,
  VendorOrder,
  VendorProfile,
  PlatformSetting,
  VendorEarnings,
  VendorLedger,
  VendorPayout,
  PayoutStatus,
} from '../models';
import {
  RequestPayoutInput,
  UpdatePayoutStatusInput,
  PayoutFilterInput,
} from '../validators/commission.validator';
import { AppError } from '../utils/apiError';
import { logger } from '../utils/logger';

export class CommissionService {
  public static readonly DEFAULT_COMMISSION_RATE = 10.0; // 10%
  public static readonly DEFAULT_MIN_PAYOUT = 100.0; // ₹100

  /**
   * Task 1: Resolves the effective commission rate for a vendor.
   * Priority: VendorProfile override -> PlatformSetting -> Hardcoded default (10%).
   */
  static async getEffectiveCommissionRate(vendorId: string | Types.ObjectId): Promise<number> {
    const vId = typeof vendorId === 'string' ? new Types.ObjectId(vendorId) : vendorId;
    const vendorProfile = await VendorProfile.findOne({
      $or: [{ userId: vId }, { vendorId: vId }],
    }).lean();

    if (
      vendorProfile &&
      vendorProfile.commissionRate !== undefined &&
      vendorProfile.commissionRate !== null
    ) {
      return Number(vendorProfile.commissionRate);
    }

    const platformSetting = await PlatformSetting.findOne({ key: 'default_commission_rate' }).lean();
    if (platformSetting && typeof platformSetting.value === 'number') {
      return Number(platformSetting.value);
    }

    return this.DEFAULT_COMMISSION_RATE;
  }

  /**
   * Retrieves the configured minimum payout amount.
   */
  static async getMinPayoutAmount(): Promise<number> {
    const setting = await PlatformSetting.findOne({ key: 'min_payout_amount' }).lean();
    if (setting && typeof setting.value === 'number') {
      return Number(setting.value);
    }
    return this.DEFAULT_MIN_PAYOUT;
  }

  /**
   * Task 2: Automatically calculates and records commissions for all vendor orders in a parent order.
   * Triggered upon verified payment capture (via verification API or webhook).
   * Fully idempotent: won't recalculate if already processed.
   * Decimal-safe calculation using paise / minor units.
   * Reconciliation invariant: grossAmount = platformFee + vendorEarnings
   */
  static async calculateAndRecordCommission(parentOrderId: string | Types.ObjectId): Promise<void> {
    const pOrderId = typeof parentOrderId === 'string' ? new Types.ObjectId(parentOrderId) : parentOrderId;
    const order = await Order.findById(pOrderId);
    if (!order) {
      logger.warn(`Commission calculation skipped: Order ${pOrderId} not found.`);
      return;
    }

    if (order.paymentStatus !== 'paid') {
      logger.info(`Commission calculation deferred: Order ${order.orderNumber} is not marked paid.`);
      return;
    }

    const vendorOrders = await VendorOrder.find({ parentOrderId: pOrderId });
    if (!vendorOrders || vendorOrders.length === 0) {
      logger.warn(`No vendor orders found for parent order ${order.orderNumber}`);
      return;
    }

    for (const vo of vendorOrders) {
      // Idempotency check: if commission already calculated on this vendor order, skip
      if (vo.commission && vo.commission.calculatedAt) {
        logger.info(`Commission already calculated for vendor order ${vo.vendorOrderNumber}. Skipping.`);
        continue;
      }

      // Check whether an existing ledger entry already exists for this vendor order
      const existingLedger = await VendorLedger.findOne({
        vendorOrderId: vo._id,
        transactionType: 'order_earning',
      });
      if (existingLedger) {
        logger.info(`Ledger entry already exists for vendor order ${vo.vendorOrderNumber}. Skipping.`);
        continue;
      }

      const grossAmount = vo.vendorSubtotal; // Commissionable base is product subtotal (excluding shipping/taxes)
      const commissionRate = await this.getEffectiveCommissionRate(vo.vendorId);

      // Decimal-safe integer minor units (paise) calculation
      const grossPaise = Math.round(grossAmount * 100);
      const platformFeePaise = Math.round((grossPaise * commissionRate) / 100);
      const vendorEarningsPaise = grossPaise - platformFeePaise;

      const platformFee = platformFeePaise / 100;
      const vendorEarnings = vendorEarningsPaise / 100;

      // Verification of financial reconciliation
      if (grossPaise !== platformFeePaise + vendorEarningsPaise) {
        throw AppError.internal('Commission reconciliation error: minor units do not sum to gross amount');
      }

      // Immutable commission snapshot on VendorOrder
      vo.commission = {
        grossAmount,
        commissionRate,
        platformFee,
        vendorEarnings,
        calculatedAt: new Date(),
      };
      await vo.save();

      // Atomically update VendorEarnings
      const updatedEarnings = await VendorEarnings.findOneAndUpdate(
        { vendorId: vo.vendorId },
        {
          $inc: {
            totalGrossSales: grossAmount,
            totalCommission: platformFee,
            availableBalance: vendorEarnings,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // Record immutable ledger credit entry
      await VendorLedger.create({
        vendorId: vo.vendorId,
        transactionType: 'order_earning',
        direction: 'credit',
        amount: vendorEarnings,
        balanceAfter: updatedEarnings.availableBalance,
        parentOrderId: order._id,
        vendorOrderId: vo._id,
        reference: vo.vendorOrderNumber,
        description: `Net earnings for vendor order ${vo.vendorOrderNumber} (Gross: ₹${grossAmount.toFixed(2)}, Platform Fee [${commissionRate}%]: ₹${platformFee.toFixed(2)})`,
        metadata: {
          parentOrderNumber: order.orderNumber,
          vendorOrderNumber: vo.vendorOrderNumber,
          grossAmount,
          commissionRate,
          platformFee,
          vendorEarnings,
          shippingShare: vo.shippingShare,
        },
      });

      logger.info(
        `Recorded commission for ${vo.vendorOrderNumber}: Gross ₹${grossAmount}, Fee ₹${platformFee}, Net ₹${vendorEarnings} to vendor ${vo.vendorId}`
      );
    }
  }

  /**
   * Task 3: Retrieves current earnings, balances, and summary stats for a vendor.
   */
  static async getVendorEarnings(vendorId: string | Types.ObjectId) {
    const vId = typeof vendorId === 'string' ? new Types.ObjectId(vendorId) : vendorId;
    let earnings = await VendorEarnings.findOne({ vendorId: vId });
    if (!earnings) {
      earnings = await VendorEarnings.create({
        vendorId: vId,
        totalGrossSales: 0,
        totalCommission: 0,
        availableBalance: 0,
        pendingBalance: 0,
        paidOutAmount: 0,
      });
    }

    const effectiveRate = await this.getEffectiveCommissionRate(vId);
    const minPayout = await this.getMinPayoutAmount();

    // Count pending payout requests
    const pendingPayoutsCount = await VendorPayout.countDocuments({
      vendorId: vId,
      payoutStatus: { $in: ['requested', 'approved', 'processing'] },
    });

    return {
      vendorId: vId.toString(),
      totalGrossSales: earnings.totalGrossSales,
      totalCommission: earnings.totalCommission,
      netEarnings: Math.round((earnings.totalGrossSales - earnings.totalCommission) * 100) / 100,
      availableBalance: earnings.availableBalance,
      pendingBalance: earnings.pendingBalance,
      paidOutAmount: earnings.paidOutAmount,
      effectiveCommissionRate: effectiveRate,
      minPayoutAmount: minPayout,
      pendingPayoutsCount,
      updatedAt: earnings.updatedAt,
    };
  }

  /**
   * Task 3 & 5: Paginated transaction ledger for a vendor.
   */
  static async getVendorTransactions(
    vendorId: string | Types.ObjectId,
    page = 1,
    limit = 20
  ) {
    const vId = typeof vendorId === 'string' ? new Types.ObjectId(vendorId) : vendorId;
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      VendorLedger.find({ vendorId: vId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      VendorLedger.countDocuments({ vendorId: vId }),
    ]);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Task 4 & 5: Paginated payout history for a vendor.
   */
  static async getVendorPayouts(
    vendorId: string | Types.ObjectId,
    page = 1,
    limit = 20
  ) {
    const vId = typeof vendorId === 'string' ? new Types.ObjectId(vendorId) : vendorId;
    const skip = (page - 1) * limit;

    const [payouts, total] = await Promise.all([
      VendorPayout.find({ vendorId: vId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      VendorPayout.countDocuments({ vendorId: vId }),
    ]);

    return {
      payouts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Task 5: Vendor requests a payout.
   * Atomically verifies and reserves balance: availableBalance -> pendingBalance.
   * Enforces min payout threshold and creates debit ledger entry.
   */
  static async requestPayout(
    vendorId: string | Types.ObjectId,
    input: RequestPayoutInput
  ) {
    const vId = typeof vendorId === 'string' ? new Types.ObjectId(vendorId) : vendorId;

    // Idempotency check if idempotencyKey supplied
    if (input.idempotencyKey) {
      const existingPayout = await VendorPayout.findOne({
        vendorId: vId,
        idempotencyKey: input.idempotencyKey,
      });
      if (existingPayout) {
        logger.info(`Idempotent payout request hit for key: ${input.idempotencyKey}`);
        return existingPayout;
      }
    }

    const minPayout = await this.getMinPayoutAmount();
    if (input.amount < minPayout) {
      throw AppError.badRequest(`Minimum payout withdrawal is ₹${minPayout}`);
    }

    // Atomic balance reservation: Ensure sufficient available balance
    const updatedEarnings = await VendorEarnings.findOneAndUpdate(
      {
        vendorId: vId,
        availableBalance: { $gte: input.amount },
      },
      {
        $inc: {
          availableBalance: -input.amount,
          pendingBalance: input.amount,
        },
      },
      { new: true }
    );

    if (!updatedEarnings) {
      throw AppError.badRequest('Insufficient available balance for this payout request');
    }

    const payoutNumber = `PO-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const payout = await VendorPayout.create({
      vendorId: vId,
      payoutNumber,
      requestedAmount: input.amount,
      payoutStatus: 'requested',
      destinationReference: input.destinationReference,
      requestedAt: new Date(),
      idempotencyKey: input.idempotencyKey,
    });

    // Debit ledger transaction for balance lock
    await VendorLedger.create({
      vendorId: vId,
      transactionType: 'payout_requested',
      direction: 'debit',
      amount: input.amount,
      balanceAfter: updatedEarnings.availableBalance,
      payoutId: payout._id,
      reference: payoutNumber,
      description: `Payout request ${payoutNumber} of ₹${input.amount.toFixed(2)} submitted to ${input.destinationReference}`,
      metadata: {
        destinationReference: input.destinationReference,
        payoutId: payout._id,
      },
    });

    logger.info(`Vendor ${vId} requested payout ${payoutNumber} for ₹${input.amount}`);
    return payout;
  }

  /**
   * Task 6: Admin payout management list with status filters & financial overview.
   */
  static async getAdminPayouts(filters: PayoutFilterInput) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const query: Record<string, any> = {};
    if (filters.status) {
      query.payoutStatus = filters.status;
    }
    if (filters.vendorId) {
      query.vendorId = new Types.ObjectId(filters.vendorId);
    }

    const [payouts, total, overviewStats] = await Promise.all([
      VendorPayout.find(query)
        .populate('vendorId', 'fullName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      VendorPayout.countDocuments(query),
      this.getAdminCommissionOverview(),
    ]);

    return {
      payouts,
      overview: overviewStats,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Task 6: Retrieve single payout request by ID with complete audit info.
   */
  static async getAdminPayoutById(payoutId: string) {
    if (!Types.ObjectId.isValid(payoutId)) {
      throw AppError.badRequest('Invalid payout ID format');
    }

    const payout = await VendorPayout.findById(payoutId)
      .populate('vendorId', 'fullName email')
      .populate('processedBy', 'fullName email');

    if (!payout) {
      throw AppError.notFound('Payout request not found');
    }

    const [earnings, vendorProfile, recentLedgers] = await Promise.all([
      VendorEarnings.findOne({ vendorId: payout.vendorId._id || payout.vendorId }),
      VendorProfile.findOne({
        $or: [
          { userId: payout.vendorId._id || payout.vendorId },
          { vendorId: payout.vendorId._id || payout.vendorId },
        ],
      }),
      VendorLedger.find({ vendorId: payout.vendorId._id || payout.vendorId })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    return {
      payout,
      earnings,
      vendorProfile,
      recentLedgers,
    };
  }

  /**
   * Task 6: Admin approves payout request (transitions requested -> approved).
   */
  static async approvePayout(adminId: string, payoutId: string) {
    if (!Types.ObjectId.isValid(payoutId)) {
      throw AppError.badRequest('Invalid payout ID format');
    }

    const payout = await VendorPayout.findById(payoutId);
    if (!payout) {
      throw AppError.notFound('Payout request not found');
    }

    if (payout.payoutStatus !== 'requested') {
      throw AppError.badRequest(`Cannot approve payout currently in status '${payout.payoutStatus}'`);
    }

    payout.payoutStatus = 'approved';
    payout.approvedAmount = payout.requestedAmount;
    payout.processedBy = new Types.ObjectId(adminId);
    payout.processedAt = new Date();
    await payout.save();

    logger.info(`Admin ${adminId} approved payout ${payout.payoutNumber} for ₹${payout.requestedAmount}`);
    return payout;
  }

  /**
   * Task 6: Admin rejects payout request.
   * Restores reserved balance atomically: pendingBalance -> availableBalance.
   * Records credit reversal ledger entry.
   */
  static async rejectPayout(adminId: string, payoutId: string, rejectionReason: string) {
    if (!Types.ObjectId.isValid(payoutId)) {
      throw AppError.badRequest('Invalid payout ID format');
    }

    const payout = await VendorPayout.findById(payoutId);
    if (!payout) {
      throw AppError.notFound('Payout request not found');
    }

    if (!['requested', 'approved'].includes(payout.payoutStatus)) {
      throw AppError.badRequest(`Cannot reject payout in terminal status '${payout.payoutStatus}'`);
    }

    // Atomic balance restoration: return reserved funds from pending to available
    const updatedEarnings = await VendorEarnings.findOneAndUpdate(
      {
        vendorId: payout.vendorId,
        pendingBalance: { $gte: payout.requestedAmount },
      },
      {
        $inc: {
          availableBalance: payout.requestedAmount,
          pendingBalance: -payout.requestedAmount,
        },
      },
      { new: true }
    );

    payout.payoutStatus = 'rejected';
    payout.rejectionReason = rejectionReason;
    payout.processedBy = new Types.ObjectId(adminId);
    payout.processedAt = new Date();
    await payout.save();

    // Record credit reversal ledger entry
    await VendorLedger.create({
      vendorId: payout.vendorId,
      transactionType: 'payout_rejected',
      direction: 'credit',
      amount: payout.requestedAmount,
      balanceAfter: updatedEarnings ? updatedEarnings.availableBalance : 0,
      payoutId: payout._id,
      reference: payout.payoutNumber,
      description: `Payout ${payout.payoutNumber} rejected: ${rejectionReason}. Reserved balance restored.`,
      metadata: {
        rejectionReason,
        rejectedBy: adminId,
      },
    });

    logger.info(`Admin ${adminId} rejected payout ${payout.payoutNumber}. Reserved funds restored.`);
    return payout;
  }

  /**
   * Task 6: Update payout status (processing, paid, failed).
   * If paid: pendingBalance -> paidOutAmount.
   * If failed: restores balance pendingBalance -> availableBalance.
   */
  static async updatePayoutStatus(
    adminId: string,
    payoutId: string,
    input: UpdatePayoutStatusInput
  ) {
    if (!Types.ObjectId.isValid(payoutId)) {
      throw AppError.badRequest('Invalid payout ID format');
    }

    const payout = await VendorPayout.findById(payoutId);
    if (!payout) {
      throw AppError.notFound('Payout request not found');
    }

    const { status, providerReference, failureReason, rejectionReason } = input;

    // Terminal statuses cannot be transitioned
    if (['paid', 'rejected', 'failed'].includes(payout.payoutStatus)) {
      throw AppError.badRequest(`Payout is already finalized with status '${payout.payoutStatus}'`);
    }

    if (status === 'paid') {
      if (!['approved', 'processing'].includes(payout.payoutStatus)) {
        throw AppError.badRequest(`Payout must be 'approved' or 'processing' before marking 'paid'`);
      }

      // Finalize transfer: move from pendingBalance to paidOutAmount
      await VendorEarnings.findOneAndUpdate(
        {
          vendorId: payout.vendorId,
          pendingBalance: { $gte: payout.requestedAmount },
        },
        {
          $inc: {
            pendingBalance: -payout.requestedAmount,
            paidOutAmount: payout.requestedAmount,
          },
        }
      );

      payout.payoutStatus = 'paid';
      payout.providerReference = providerReference || `MANUAL-${Date.now()}`;
      payout.processedAt = new Date();
      payout.processedBy = new Types.ObjectId(adminId);
      await payout.save();

      const earnings = await VendorEarnings.findOne({ vendorId: payout.vendorId });

      await VendorLedger.create({
        vendorId: payout.vendorId,
        transactionType: 'payout_processed',
        direction: 'debit',
        amount: payout.requestedAmount,
        balanceAfter: earnings ? earnings.availableBalance : 0,
        payoutId: payout._id,
        reference: payout.payoutNumber,
        description: `Payout ${payout.payoutNumber} settled. Provider Ref: ${payout.providerReference}`,
        metadata: {
          providerReference: payout.providerReference,
          settledBy: adminId,
        },
      });

      logger.info(`Payout ${payout.payoutNumber} settled and marked paid.`);
    } else if (status === 'failed') {
      if (!['approved', 'processing'].includes(payout.payoutStatus)) {
        throw AppError.badRequest(`Payout must be 'approved' or 'processing' before marking 'failed'`);
      }

      const updatedEarnings = await VendorEarnings.findOneAndUpdate(
        {
          vendorId: payout.vendorId,
          pendingBalance: { $gte: payout.requestedAmount },
        },
        {
          $inc: {
            availableBalance: payout.requestedAmount,
            pendingBalance: -payout.requestedAmount,
          },
        },
        { new: true }
      );

      payout.payoutStatus = 'failed';
      payout.failureReason = failureReason || 'Payout processing failed by provider';
      payout.processedAt = new Date();
      payout.processedBy = new Types.ObjectId(adminId);
      await payout.save();

      await VendorLedger.create({
        vendorId: payout.vendorId,
        transactionType: 'payout_failed',
        direction: 'credit',
        amount: payout.requestedAmount,
        balanceAfter: updatedEarnings ? updatedEarnings.availableBalance : 0,
        payoutId: payout._id,
        reference: payout.payoutNumber,
        description: `Payout ${payout.payoutNumber} failed: ${payout.failureReason}. Reserved balance restored.`,
        metadata: {
          failureReason: payout.failureReason,
          failedBy: adminId,
        },
      });

      logger.warn(`Payout ${payout.payoutNumber} failed. Balance restored.`);
    } else if (status === 'processing') {
      if (!['requested', 'approved'].includes(payout.payoutStatus)) {
        throw AppError.badRequest(`Payout cannot move to 'processing' from status '${payout.payoutStatus}'`);
      }

      payout.payoutStatus = 'processing';
      if (providerReference) payout.providerReference = providerReference;
      payout.processedBy = new Types.ObjectId(adminId);
      await payout.save();
    } else if (status === 'approved') {
      return this.approvePayout(adminId, payoutId);
    } else if (status === 'rejected') {
      return this.rejectPayout(adminId, payoutId, rejectionReason || 'Rejected by administrator');
    }

    return payout;
  }

  /**
   * Task 1: Admin commission overview and configuration.
   */
  static async getAdminCommissionOverview() {
    const defaultRateSetting = await PlatformSetting.findOne({ key: 'default_commission_rate' }).lean();
    const minPayoutSetting = await PlatformSetting.findOne({ key: 'min_payout_amount' }).lean();

    // Aggregate totals from VendorEarnings
    const earningsAggregation = await VendorEarnings.aggregate([
      {
        $group: {
          _id: null,
          totalGrossSales: { $sum: '$totalGrossSales' },
          totalPlatformCommission: { $sum: '$totalCommission' },
          totalAvailableBalance: { $sum: '$availableBalance' },
          totalPendingBalance: { $sum: '$pendingBalance' },
          totalPaidOutAmount: { $sum: '$paidOutAmount' },
        },
      },
    ]);

    const stats = earningsAggregation[0] || {
      totalGrossSales: 0,
      totalPlatformCommission: 0,
      totalAvailableBalance: 0,
      totalPendingBalance: 0,
      totalPaidOutAmount: 0,
    };

    // Vendors with overrides
    const vendorOverrides = await VendorProfile.find({
      commissionRate: { $exists: true, $ne: null },
    })
      .select('userId storeName commissionRate')
      .populate('userId', 'name fullName email')
      .lean();

    return {
      defaultCommissionRate:
        defaultRateSetting && typeof defaultRateSetting.value === 'number'
          ? defaultRateSetting.value
          : this.DEFAULT_COMMISSION_RATE,
      minPayoutAmount:
        minPayoutSetting && typeof minPayoutSetting.value === 'number'
          ? minPayoutSetting.value
          : this.DEFAULT_MIN_PAYOUT,
      stats: {
        totalGrossSales: Math.round(stats.totalGrossSales * 100) / 100,
        totalPlatformCommission: Math.round(stats.totalPlatformCommission * 100) / 100,
        totalAvailableBalance: Math.round(stats.totalAvailableBalance * 100) / 100,
        totalPendingBalance: Math.round(stats.totalPendingBalance * 100) / 100,
        totalPaidOutAmount: Math.round(stats.totalPaidOutAmount * 100) / 100,
      },
      vendorOverrides,
    };
  }

  /**
   * Task 1: Update platform default commission percentage.
   */
  static async updatePlatformCommission(adminId: string, rate: number) {
    const updated = await PlatformSetting.findOneAndUpdate(
      { key: 'default_commission_rate' },
      {
        value: rate,
        description: 'Global default marketplace commission percentage applied to vendor orders',
        updatedBy: new Types.ObjectId(adminId),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    logger.info(`Admin ${adminId} updated platform default commission rate to ${rate}%`);
    return updated;
  }

  /**
   * Task 1: Set or remove custom vendor commission rate.
   */
  static async updateVendorCommission(
    adminId: string,
    vendorId: string,
    rate: number | null
  ) {
    if (!Types.ObjectId.isValid(vendorId)) {
      throw AppError.badRequest('Invalid vendor ID format');
    }

    const vendorProfile = await VendorProfile.findOne({
      $or: [
        { userId: new Types.ObjectId(vendorId) },
        { vendorId: new Types.ObjectId(vendorId) },
      ],
    });

    if (!vendorProfile) {
      throw AppError.notFound('Vendor profile not found for this user');
    }

    vendorProfile.commissionRate = rate === null ? undefined : rate;
    await vendorProfile.save();

    logger.info(`Admin ${adminId} updated vendor ${vendorId} commission rate to ${rate}%`);
    return vendorProfile;
  }
}
