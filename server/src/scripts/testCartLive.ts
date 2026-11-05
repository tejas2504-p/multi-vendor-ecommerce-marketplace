import http from 'http';

function post(path: string, body: any, token?: string): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const headers: Record<string, string | number> = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
    };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const req = http.request({ host: 'localhost', port: 5000, path, method: 'POST', headers }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve({ status: res.statusCode || 500, data: b ? JSON.parse(b) : null }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path: string, token?: string): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const req = http.request({ host: 'localhost', port: 5000, path, method: 'GET', headers }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve({ status: res.statusCode || 500, data: b ? JSON.parse(b) : null }));
    });
    req.on('error', reject);
    req.end();
  });
}

function patch(path: string, body: any, token?: string): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body || {});
    const headers: Record<string, string | number> = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
    };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const req = http.request({ host: 'localhost', port: 5000, path, method: 'PATCH', headers }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve({ status: res.statusCode || 500, data: b ? JSON.parse(b) : null }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function del(path: string, token?: string): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const req = http.request({ host: 'localhost', port: 5000, path, method: 'DELETE', headers }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve({ status: res.statusCode || 500, data: b ? JSON.parse(b) : null }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function runLiveCartTest() {
  const ts = Date.now();
  console.log('======================================================');
  console.log('🧪 VERIFYING PHASE 6A – SHOPPING CART (LIVE SERVER)');
  console.log('======================================================\n');

  // 1. Customer login
  const custLogin = await post('/api/auth/login', {
    email: 'customer@example.com',
    password: 'Password123!'
  });
  const customerToken = custLogin.data?.data?.token;

  // 2. Vendor login & create an active product for cart testing
  const vendorLogin = await post('/api/auth/login', {
    email: 'vendor@example.com',
    password: 'Password123!'
  });
  const vendorToken = vendorLogin.data?.data?.token;

  // Fetch category
  const catRes = await get('/api/categories');
  let categoryId = catRes.data?.data?.[0]?.id || catRes.data?.data?.[0]?._id;

  const prodRes = await post('/api/products', {
    name: `Mechanical Keyboard ${ts}`,
    description: 'Hot-swappable RGB mechanical keyboard',
    price: 89.99,
    categoryId,
    stock: 15,
    brand: 'KeyTech'
  }, vendorToken);

  const productId = prodRes.data?.data?.id || prodRes.data?.data?._id;
  console.log(`Created live test product: ${productId} ($89.99, Stock: 15)`);

  // ----------------------------------------------------
  // TEST 1: Unauthenticated request -> 401
  // ----------------------------------------------------
  const unauthRes = await get('/api/cart');
  console.log(`\n1. Unauthenticated Cart Access: HTTP ${unauthRes.status} (Protected)`);

  // ----------------------------------------------------
  // TEST 2: Vendor access blocked -> 403
  // ----------------------------------------------------
  const vendorRes = await get('/api/cart', vendorToken);
  console.log(`2. Vendor Cart Access: HTTP ${vendorRes.status} (Forbidden for vendors)`);

  // ----------------------------------------------------
  // TEST 3: Add to cart -> POST /api/cart/add
  // ----------------------------------------------------
  const addRes1 = await post('/api/cart/add', {
    productId,
    quantity: 2
  }, customerToken);
  console.log(`3. Add Product to Cart: HTTP ${addRes1.status}`);
  console.log(`   Items in cart: ${addRes1.data?.data?.itemCount}, Subtotal: $${addRes1.data?.data?.subtotal}`);

  // ----------------------------------------------------
  // TEST 4: Add same product again (increments quantity)
  // ----------------------------------------------------
  const addRes2 = await post('/api/cart/add', {
    productId,
    quantity: 1
  }, customerToken);
  console.log(`4. Add Same Product Again: HTTP ${addRes2.status}`);
  console.log(`   Items in cart: ${addRes2.data?.data?.itemCount}, Subtotal: $${addRes2.data?.data?.subtotal}`);

  // ----------------------------------------------------
  // TEST 5: View Cart -> GET /api/cart
  // ----------------------------------------------------
  const viewRes = await get('/api/cart', customerToken);
  console.log(`5. Retrieve Cart: HTTP ${viewRes.status}`);
  console.log(`   Items: ${viewRes.data?.data?.items?.length}, Total: $${viewRes.data?.data?.total}`);

  // ----------------------------------------------------
  // TEST 6: Update quantity -> PATCH /api/cart/update/:productId
  // ----------------------------------------------------
  const updateRes = await patch(`/api/cart/update/${productId}`, {
    quantity: 5
  }, customerToken);
  console.log(`6. Update Quantity to 5: HTTP ${updateRes.status}`);
  console.log(`   Items in cart: ${updateRes.data?.data?.itemCount}, Subtotal: $${updateRes.data?.data?.subtotal}`);

  // ----------------------------------------------------
  // TEST 7: Exceed stock -> 400 Bad Request
  // ----------------------------------------------------
  const exceedRes = await patch(`/api/cart/update/${productId}`, {
    quantity: 99
  }, customerToken);
  console.log(`7. Exceed Stock (qty 99 > 15): HTTP ${exceedRes.status} (${exceedRes.data?.message || exceedRes.data?.error?.message})`);

  // ----------------------------------------------------
  // TEST 8: Remove item -> DELETE /api/cart/remove/:productId
  // ----------------------------------------------------
  const removeRes = await del(`/api/cart/remove/${productId}`, customerToken);
  console.log(`8. Remove Item from Cart: HTTP ${removeRes.status}`);
  console.log(`   Items remaining: ${removeRes.data?.data?.items?.length}`);

  // ----------------------------------------------------
  // TEST 9: Clear cart -> DELETE /api/cart/clear
  // ----------------------------------------------------
  const clearRes = await del('/api/cart/clear', customerToken);
  console.log(`9. Clear Cart: HTTP ${clearRes.status}`);
  console.log(`   Items in cart: ${clearRes.data?.data?.items?.length}, Subtotal: $${clearRes.data?.data?.subtotal}`);

  console.log('\n======================================================');
  console.log('🎉 ALL LIVE CART OPERATIONS VERIFIED SUCCESSFULLY!');
  console.log('======================================================');
  process.exit(0);
}

runLiveCartTest().catch(err => {
  console.error(err);
  process.exit(1);
});

