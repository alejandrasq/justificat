const crypto = require('crypto');
const cloudinary = require('cloudinary').v2;

const cloudinaryConfig = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
};

const isCloudinaryConfigured = Boolean(
  cloudinaryConfig.cloud_name && cloudinaryConfig.api_key && cloudinaryConfig.api_secret
);

if (isCloudinaryConfigured) {
  cloudinary.config(cloudinaryConfig);
}

function encodeCloudinaryReceipt(receipt) {
  return `cloudinary:${Buffer.from(JSON.stringify(receipt)).toString('base64url')}`;
}

function decodeCloudinaryReceipt(value) {
  if (typeof value !== 'string') return null;

  const token = value.startsWith('cloudinary:')
    ? value.slice('cloudinary:'.length)
    : value.startsWith('cloudinary-') ? value.slice('cloudinary-'.length) : value;

  if (!/^[\w-]+$/.test(token)) return null;

  try {
    const receipt = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    if (
      typeof receipt.publicId !== 'string'
      || !/^[\w/.-]+$/.test(receipt.publicId)
      || receipt.publicId.includes('..')
      || !['image', 'raw'].includes(receipt.resourceType)
      || typeof receipt.format !== 'string'
      || !/^(?:jpe?g|png|pdf)$/i.test(receipt.format)
      || typeof receipt.originalName !== 'string'
      || typeof receipt.mimetype !== 'string'
      || !Number.isInteger(receipt.version)
    ) {
      return null;
    }

    return receipt;
  } catch {
    return null;
  }
}

function uploadReceipt(file) {
  return new Promise((resolve, reject) => {
    const publicId = `receipt-${Date.now()}-${crypto.randomBytes(12).toString('hex')}`;
    const uploadStream = cloudinary.uploader.upload_stream({
      folder: 'justificat/comprobantes',
      public_id: publicId,
      resource_type: 'auto',
      type: 'authenticated',
      overwrite: false,
      use_filename: false,
      unique_filename: false
    }, (error, result) => {
      if (error) {
        reject(error);
      } else if (!result) {
        reject(new Error('Cloudinary no devolvió el comprobante guardado.'));
      } else {
        resolve({
          publicId: result.public_id,
          resourceType: result.resource_type,
          format: result.format,
          originalName: file.originalname,
          mimetype: file.mimetype,
          version: result.version
        });
      }
    });

    uploadStream.end(file.buffer);
  });
}

async function deleteReceipt(receipt) {
  return cloudinary.uploader.destroy(receipt.publicId, {
    resource_type: receipt.resourceType,
    type: 'authenticated',
    invalidate: true
  });
}

module.exports = {
  cloudinary,
  decodeCloudinaryReceipt,
  deleteReceipt,
  encodeCloudinaryReceipt,
  isCloudinaryConfigured,
  uploadReceipt
};
