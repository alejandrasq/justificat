const test = require('node:test');
const assert = require('node:assert/strict');
const {
  decodeCloudinaryReceipt,
  encodeCloudinaryReceipt
} = require('../utils/cloudinary');

test('Cloudinary receipt metadata round-trips through the database value and route token', () => {
  const receipt = {
    publicId: 'justificat/comprobantes/receipt-123',
    resourceType: 'image',
    format: 'png',
    originalName: 'comprobante.png',
    mimetype: 'image/png',
    version: 1234567890
  };
  const storedValue = encodeCloudinaryReceipt(receipt);

  assert.deepEqual(decodeCloudinaryReceipt(storedValue), receipt);
  assert.deepEqual(decodeCloudinaryReceipt(`cloudinary-${storedValue.slice('cloudinary:'.length)}`), receipt);
});

test('Cloudinary receipt decoder rejects invalid or unsafe metadata', () => {
  const unsafeReceipt = {
    publicId: '../private-file',
    resourceType: 'raw',
    format: 'pdf',
    originalName: 'comprobante.pdf',
    mimetype: 'application/pdf',
    version: 1234567890
  };

  assert.equal(decodeCloudinaryReceipt('cloudinary-not-a-valid-token!'), null);
  assert.equal(decodeCloudinaryReceipt(encodeCloudinaryReceipt(unsafeReceipt)), null);
});
