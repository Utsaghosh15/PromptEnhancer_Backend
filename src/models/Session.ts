import mongoose, { Document, Schema } from 'mongoose';

// Interface for synopsis structure
export interface ISynopsis {
  goal?: string;
  tone?: string;
  constraints?: string;
  audience?: string;
  style?: string;
  todos?: string[];
}

// Interface for Session document
export interface ISession extends Document {
  userId?: string;
  anonId?: string;
  title?: string;
  synopsis: ISynopsis;
  synopsisVersion: number;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Synopsis schema
const synopsisSchema = new Schema<ISynopsis>({
  goal: {
    type: String,
    maxlength: 120,
  },
  tone: {
    type: String,
    maxlength: 120,
  },
  constraints: {
    type: String,
    maxlength: 120,
  },
  audience: {
    type: String,
    maxlength: 120,
  },
  style: {
    type: String,
    maxlength: 120,
  },
  todos: [{
    type: String,
    maxlength: 120,
  }],
}, {
  _id: false, // Don't create _id for subdocument
});

// Session schema
const sessionSchema = new Schema<ISession>({
  userId: {
    type: String,
    required: false, // Can be anonymous
    index: true,
  },
  anonId: {
    type: String,
    required: false, // For anonymous sessions
    index: true,
  },
  title: {
    type: String,
    maxlength: 200,
  },
  synopsis: {
    type: synopsisSchema,
    required: true,
    default: () => ({}),
  },
  synopsisVersion: {
    type: Number,
    default: 0,
  },
  lastMessageAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Indexes for efficient queries
sessionSchema.index({ userId: 1, createdAt: -1 });
sessionSchema.index({ userId: 1, lastMessageAt: -1 });
sessionSchema.index({ anonId: 1, createdAt: -1 });
sessionSchema.index({ anonId: 1, lastMessageAt: -1 });

// Method to update synopsis
sessionSchema.methods.updateSynopsis = async function(newSynopsis: Partial<ISynopsis>) {
  // Merge new synopsis with existing one
  this.synopsis = {
    ...this.synopsis,
    ...newSynopsis,
  };
  
  // Increment version
  this.synopsisVersion += 1;
  
  // Update last message timestamp
  this.lastMessageAt = new Date();
  
  return await this.save();
};

// Method to add todo item
sessionSchema.methods.addTodo = async function(todo: string) {
  if (!this.synopsis.todos) {
    this.synopsis.todos = [];
  }
  
  // Add todo if it doesn't already exist
  if (!this.synopsis.todos.includes(todo)) {
    this.synopsis.todos.push(todo);
    this.synopsisVersion += 1;
    this.lastMessageAt = new Date();
    await this.save();
  }
  
  return this;
};

// Method to remove todo item
sessionSchema.methods.removeTodo = async function(todo: string) {
  if (this.synopsis.todos) {
    const index = this.synopsis.todos.indexOf(todo);
    if (index > -1) {
      this.synopsis.todos.splice(index, 1);
      this.synopsisVersion += 1;
      this.lastMessageAt = new Date();
      await this.save();
    }
  }
  
  return this;
};

// Static method to create session
sessionSchema.statics.createSession = async function(userId?: string, title?: string, anonId?: string) {
  const session = new this({
    userId,
    anonId,
    title,
    synopsis: {},
    synopsisVersion: 0,
    lastMessageAt: new Date(),
  });
  
  return await session.save();
};

export const Session = mongoose.model<ISession>('Session', sessionSchema);
