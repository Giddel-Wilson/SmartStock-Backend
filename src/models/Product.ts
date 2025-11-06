import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
  name: string;
  sku: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  lowStockThreshold: number;
  categoryId?: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema: Schema = new Schema({
  name: { type: String, required: true },
  sku: { type: String, required: true, unique: true },
  description: { type: String, default: null },
  quantity: { type: Number, required: true, default: 0 },
  unitPrice: { type: Number, required: true },
  lowStockThreshold: { type: Number, default: 10 },
  categoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for performance
ProductSchema.index({ categoryId: 1 });
ProductSchema.index({ sku: 1 });
ProductSchema.index({ quantity: 1 });

// Update the updatedAt timestamp on save
ProductSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model<IProduct>('Product', ProductSchema);
