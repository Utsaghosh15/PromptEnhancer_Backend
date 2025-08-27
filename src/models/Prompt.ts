import mongoose, { Document, Schema } from 'mongoose';

// Interface for context usage tracking
export interface IContextUsed {
  lastTurns: number;
  synopsisChars: number;
}

// Interface for token usage
export interface ITokens {
  in: number;
  out: number;
}

// Interface for Prompt document
export interface IPrompt extends Document {
  userId?: string;
  sessionId?: string;
  original: string;
  enhanced: string;
  useHistory: boolean;
  contextUsed: IContextUsed;
  model: string;
  latencyMs: number;
  tokens: ITokens;
  accepted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Context used schema
const contextUsedSchema = new Schema<IContextUsed>({
  lastTurns: {
    type: Number,
    default: 0,
  },
  synopsisChars: {
    type: Number,
    default: 0,
  },
}, {
  _id: false,
});

// Tokens schema
const tokensSchema = new Schema<ITokens>({
  in: {
    type: Number,
    required: true,
  },
  out: {
    type: Number,
    required: true,
  },
}, {
  _id: false,
});

// Prompt schema
const promptSchema = new Schema<IPrompt>({
  userId: {
    type: String,
    required: false, // Can be anonymous
    index: true,
  },
  sessionId: {
    type: Schema.Types.ObjectId,
    ref: 'Session',
    required: false,
    index: true,
  },
  original: {
    type: String,
    required: true,
    maxlength: 10000, // 10KB limit
  },
  enhanced: {
    type: String,
    required: true,
    maxlength: 10000, // 10KB limit
  },
  useHistory: {
    type: Boolean,
    required: true,
    default: false,
  },
  contextUsed: {
    type: contextUsedSchema,
    required: true,
    default: () => ({ lastTurns: 0, synopsisChars: 0 }),
  },
  model: {
    type: String,
    required: true,
  },
  latencyMs: {
    type: Number,
    required: true,
  },
  tokens: {
    type: tokensSchema,
    required: true,
  },
  accepted: {
    type: Boolean,
    required: false,
  },
}, {
  timestamps: true,
});

// Indexes for efficient queries
promptSchema.index({ userId: 1, createdAt: -1 });
promptSchema.index({ sessionId: 1, createdAt: -1 });
promptSchema.index({ userId: 1, accepted: 1 });
promptSchema.index({ createdAt: -1 });

// Method to mark as accepted/rejected
promptSchema.methods.markFeedback = async function(accepted: boolean) {
  this.accepted = accepted;
  return await this.save();
};

// Static method to create prompt
promptSchema.statics.createPrompt = async function(data: {
  userId?: string;
  sessionId?: string;
  original: string;
  enhanced: string;
  useHistory: boolean;
  contextUsed: IContextUsed;
  model: string;
  latencyMs: number;
  tokens: ITokens;
}) {
  const prompt = new this(data);
  return await prompt.save();
};

// Static method to get user's prompt history
promptSchema.statics.getUserHistory = async function(userId: string, limit: number = 50) {
  return await this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('original enhanced accepted createdAt');
};

// Static method to get session's prompt history
promptSchema.statics.getSessionHistory = async function(sessionId: string, limit: number = 50) {
  return await this.find({ sessionId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('original enhanced accepted createdAt');
};

// Static method to get acceptance rate
promptSchema.statics.getAcceptanceRate = async function(userId?: string) {
  const match: any = {};
  if (userId) {
    match.userId = userId;
  }
  
  const result = await this.aggregate([
    { $match: { ...match, accepted: { $exists: true } } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        accepted: {
          $sum: { $cond: ['$accepted', 1, 0] }
        }
      }
    }
  ]);
  
  if (result.length === 0) {
    return { total: 0, accepted: 0, rate: 0 };
  }
  
  const { total, accepted } = result[0];
  return {
    total,
    accepted,
    rate: total > 0 ? (accepted / total) * 100 : 0
  };
};

export const Prompt = mongoose.model<IPrompt>('Prompt', promptSchema);
