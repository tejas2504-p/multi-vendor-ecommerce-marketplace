import { Types } from 'mongoose';
import { Address, IAddress, AddressDocument } from '../models/address.model';
import { AppError } from '../utils/apiError';
import { CreateAddressInput, UpdateAddressInput } from '../validators/address.validator';

export class AddressService {
  /**
   * Create a new address for the authenticated customer.
   * If customer has no existing addresses, this address automatically becomes default.
   * If this address is set as default, all other customer addresses are unset as default.
   */
  static async createAddress(userId: string, input: CreateAddressInput): Promise<AddressDocument> {
    const userObjectId = new Types.ObjectId(userId);
    const existingCount = await Address.countDocuments({ userId: userObjectId });

    const shouldBeDefault = existingCount === 0 ? true : Boolean(input.isDefault);

    if (shouldBeDefault && existingCount > 0) {
      await Address.updateMany({ userId: userObjectId }, { isDefault: false });
    }

    const address = await Address.create({
      ...input,
      userId: userObjectId,
      isDefault: shouldBeDefault,
    });

    return address;
  }

  /**
   * Retrieve all addresses belonging to the authenticated customer.
   * Default address is returned first, followed by newest additions.
   */
  static async getAddresses(userId: string): Promise<AddressDocument[]> {
    const userObjectId = new Types.ObjectId(userId);
    return Address.find({ userId: userObjectId }).sort({ isDefault: -1, createdAt: -1 });
  }

  /**
   * Retrieve a specific address by ID, strictly verifying customer ownership.
   */
  static async getAddressById(userId: string, addressId: string): Promise<AddressDocument> {
    const address = await Address.findById(addressId);
    if (!address) {
      throw AppError.notFound('Address not found');
    }

    if (address.userId.toString() !== userId) {
      throw AppError.forbidden('Access forbidden: You do not own this address');
    }

    return address;
  }

  /**
   * Update an address, strictly enforcing customer ownership.
   * If updated to default, unsets default on all other addresses.
   */
  static async updateAddress(
    userId: string,
    addressId: string,
    input: UpdateAddressInput
  ): Promise<AddressDocument> {
    const address = await this.getAddressById(userId, addressId);
    const userObjectId = new Types.ObjectId(userId);

    if (input.isDefault === true) {
      await Address.updateMany({ userId: userObjectId, _id: { $ne: address._id } }, { isDefault: false });
    }

    Object.assign(address, input);
    await address.save();

    return address;
  }

  /**
   * Set a specific address as default, unsetting all other customer addresses.
   */
  static async setDefaultAddress(userId: string, addressId: string): Promise<AddressDocument> {
    const address = await this.getAddressById(userId, addressId);
    const userObjectId = new Types.ObjectId(userId);

    await Address.updateMany({ userId: userObjectId }, { isDefault: false });
    address.isDefault = true;
    await address.save();

    return address;
  }

  /**
   * Delete an address, strictly enforcing customer ownership.
   * If the default address is deleted, the most recently created remaining address
   * is automatically promoted to default to ensure a seamless checkout experience.
   */
  static async deleteAddress(userId: string, addressId: string): Promise<{ deleted: boolean; newDefaultId?: string }> {
    const address = await this.getAddressById(userId, addressId);
    const wasDefault = address.isDefault;
    const userObjectId = new Types.ObjectId(userId);

    await Address.deleteOne({ _id: address._id });

    let newDefaultId: string | undefined;

    if (wasDefault) {
      const remainingAddress = await Address.findOne({ userId: userObjectId }).sort({ createdAt: -1 });
      if (remainingAddress) {
        remainingAddress.isDefault = true;
        await remainingAddress.save();
        newDefaultId = remainingAddress._id.toString();
      }
    }

    return { deleted: true, newDefaultId };
  }
}
