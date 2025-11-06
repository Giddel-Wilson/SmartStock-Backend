import mongoose, { Schema, Document } from 'mongoose';

export interface IInventoryLog extends Document {
  productId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  changeType: 'restock' | 'sale' | 'edit' | 'return';
  quantityChanged: number;
  oldQuantity: number;
  newQuantity: number;
  transactionDate: Date;
  notes?: string;
}

const InventoryLogSchema: Schema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  changeType: { 
    type: String, 
    required: true, 
    enum: ['restock', 'sale', 'edit', 'return'] 
  },
  quantityChanged: { type: Number, required: true },
  oldQuantity: { type: Number, required: true },
  newQuantity: { type: Number, required: true },
  transactionDate: { type: Date, default: Date.now },
  notes: { type: String, default: null }
});

// Indexes for performance
InventoryLogSchema.index({ productId: 1 });
InventoryLogSchema.index({ userId: 1 });
InventoryLogSchema.index({ transactionDate: -1 });

export default mongoose.model<IInventoryLog>('InventoryLog', InventoryLogSchema);
