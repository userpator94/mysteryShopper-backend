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

// Favorites API types
export interface FavoriteOffer {
  id: string;
  available: boolean;
  title: string;
  description: string;
  price: string;
  location: string;
  image_alt_text?: string;
  is_promo: boolean;
  start_date: string;
  end_date: string;
  employer_company: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    field?: string;
    errors?: Array<{
      field: string;
      message: string;
    }>;
  };
}

// Authentication types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  name: string;
  lastname: string;
  email: string;
  phone: string;
  password: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  lastname: string;
  phone: string;
}

export interface LoginResponse {
  success: true;
  data: {
    token: string;
    user: AuthUser;
    expiresIn: number;
  };
}

export interface SignupResponse {
  success: true;
  data: {
    token: string;
    user: AuthUser & {
      createdAt: string;
    };
    expiresIn: number;
  };
}

export interface LogoutResponse {
  success: true;
  data: {
    message: string;
  };
}

export interface AddFavoriteRequest {
  offer_id: string;
}

export interface AddFavoriteResponse {
  success: true;
  data: {
    offer_id: string;
    message: string;
  };
}

export interface RemoveFavoriteResponse {
  success: true;
  data: {
    offer_id: string;
    message: string;
  };
}

// Apply API types
export interface ApplyRequest {
  offer_id: string;
}

export interface ApplyResponse {
  success: true;
  data: {
    application_id: string;
    offer_id: string;
    user_id: string;
    applied_at: string;
    approved_at?: string;
    status?: string;
  };
}

export interface Application {
  application_id: string;
  offer_id: string;
  user_id: string;
  applied_at: string;
  approved_at?: string;
  status?: string;
}

export interface GetAppliesResponse {
  success: true;
  data: Application | Application[];
}
