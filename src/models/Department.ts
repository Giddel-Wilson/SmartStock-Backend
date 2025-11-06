import mongoose, { Schema, Document } from 'mongoose';

export interface IDepartment extends Document {
  name: string;
  description?: string;
  createdAt: Date;
}

const DepartmentSchema: Schema = new Schema({
  name: { type: String, required: true },
  description: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<IDepartment>('Department', DepartmentSchema);
