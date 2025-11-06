import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: string;
  departmentId?: mongoose.Types.ObjectId;
  phone?: string;
  lastLogin?: Date;
  isActive: boolean;
}

const UserSchema: Schema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department', default: null },
  phone: { type: String, default: null },
  lastLogin: { type: Date, default: null },
  isActive: { type: Boolean, default: true }
});

export default mongoose.model<IUser>('User', UserSchema);
