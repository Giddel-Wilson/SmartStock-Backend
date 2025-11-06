import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  categoryId?: mongoose.Types.ObjectId;
  departmentId?: mongoose.Types.ObjectId;
}

const ProductSchema: Schema = new Schema({
  name: { type: String, required: true },
  sku: { type: String, required: true, unique: true },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  categoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department', default: null }
});

export default mongoose.model<IProduct>('Product', ProductSchema);
