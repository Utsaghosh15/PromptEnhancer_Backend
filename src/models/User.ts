import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

// Interface for User document
export interface IUser extends Document {
  email: string;
  passwordHash?: string;
  providers?: {
    google?: {
      sub: string;
      name?: string;
      picture?: string;
    };
  };
  emailVerified?: boolean;
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// User schema
const userSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  passwordHash: {
    type: String,
    required: false, // Optional for OAuth users
  },
  providers: {
    google: {
      sub: {
        type: String,
        required: false,
        index: true,
      },
      name: String,
      picture: String,
    },
  },
  emailVerified: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Index for efficient queries
userSchema.index({ email: 1 });
userSchema.index({ 'providers.google.sub': 1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('passwordHash') || !this.passwordHash) {
    return next();
  }

  try {
    // Hash password with salt rounds of 12
    const salt = await bcrypt.genSalt(12);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  if (!this.passwordHash) {
    return false;
  }
  
  try {
    return await bcrypt.compare(candidatePassword, this.passwordHash);
  } catch (error) {
    return false;
  }
};

// Static method to create user with password
userSchema.statics.createWithPassword = async function(email: string, password: string) {
  const user = new this({
    email,
    passwordHash: password, // Will be hashed by pre-save middleware
    emailVerified: false,
  });
  return await user.save();
};

// Static method to find or create user by Google OAuth
userSchema.statics.findOrCreateByGoogle = async function(
  email: string,
  googleData: { sub: string; name?: string; picture?: string }
) {
  let user = await this.findOne({ email });
  
  if (!user) {
    // Create new user
    user = new this({
      email,
      providers: {
        google: googleData,
      },
      emailVerified: true, // Google emails are verified
    });
    await user.save();
  } else {
    // Update existing user with Google provider info
    user.providers = user.providers || {};
    user.providers.google = googleData;
    user.emailVerified = true;
    await user.save();
  }
  
  return user;
};

export const User = mongoose.model<IUser>('User', userSchema);
