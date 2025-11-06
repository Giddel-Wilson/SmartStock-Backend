import mongoose, { Schema, Document } from 'mongoose';

export interface IStockAlert extends Document {
  productId: mongoose.Types.ObjectId;
  thresholdReached: boolean;
  alertSent: boolean;
  sentAt?: Date;
  createdAt: Date;
}

const StockAlertSchema: Schema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, unique: true },
  thresholdReached: { type: Boolean, default: true },
  alertSent: { type: Boolean, default: false },
  sentAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

// Index for performance
StockAlertSchema.index({ productId: 1 });
StockAlertSchema.index({ alertSent: 1 });

export default mongoose.model<IStockAlert>('StockAlert', StockAlertSchema);
