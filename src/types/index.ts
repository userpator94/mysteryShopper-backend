export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    statusCode?: number;
    stack?: string;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'shopper';
  createdAt: Date;
  updatedAt: Date;
}

export interface MysteryShop {
  id: string;
  title: string;
  description: string;
  location: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assignedShopper?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShopReport {
  id: string;
  shopId: string;
  shopperId: string;
  rating: number;
  comments: string;
  photos?: string[];
  submittedAt: Date;
}

// Homepage types
export interface Offer {
  id: string;
  imageId: string;
  title: string;
  description?: string;
  numericInfo: number;
  tags: string[];
  isFavourite: boolean;
  isPromo: boolean;
  authorId: string; // ID заказчика (автора предложения)
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Banner {
  id: string;
  imageId: string;
  link: string;
  text?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PromoOffer {
  id: string;
  imageId: string;
  title: string;
  numericInfo: number;
  tags: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Image {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: Date;
}

export interface Author {
  id: string;
  name: string;
  email: string;
  company?: string;
  avatarId?: string;
  createdAt: Date;
  updatedAt: Date;
}
