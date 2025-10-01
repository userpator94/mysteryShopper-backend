import { Request, Response } from 'express';
import { ApiResponse, Banner, Offer, Image, Author } from '../types';

// Mock data - в реальном приложении это будет из базы данных
const mockBanner: Banner = {
  id: 'banner-1',
  imageId: 'img-banner-1',
  link: 'https://example.com/special-offer',
  text: 'Получите скидку 20% на первый mystery shop!',
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01')
};

const mockOffers: Offer[] = [
  {
    id: 'offer-1',
    imageId: 'img-offer-1',
    title: 'Проверка автомойки',
    description: 'Детальная оценка с фотографиями и подробным отчетом',
    numericInfo: 200,
    tags: ['популярно', 'новое'],
    isFavourite: true,
    isPromo: true,
    authorId: 'author-1',
    startDate: new Date('2023-01-01'),
    endDate: new Date('2025-12-31'),
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    id: 'offer-2',
    imageId: 'img-offer-2',
    title: 'Премиум Оценки',
    description: 'Детальная оценка с фотографиями и подробным отчетом',
    numericInfo: 95,
    tags: ['популярно', 'качество'],
    isFavourite: false,
    isPromo: false,
    authorId: 'author-2',
    startDate: new Date('2023-02-01'),
    endDate: new Date('2025-11-30'),
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    id: 'offer-3',
    imageId: 'img-offer-3',
    title: 'Проверка платежа',
    description: 'Купить по одному товару с карт Тинькофф и Альфа-Банк',
    numericInfo: 250,
    tags: ['быстро', 'онлайн'],
    isFavourite: true,
    isPromo: true,
    authorId: 'author-1',
    startDate: new Date('2023-03-01'),
    endDate: new Date('2025-10-31'),
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  }
];

const mockAuthors: Record<string, Author> = {
  'author-1': {
    id: 'author-1',
    name: 'Анна Петрова',
    email: 'anna.petrova@company.com',
    company: 'Retail Solutions',
    avatarId: 'img-avatar-1',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  'author-2': {
    id: 'author-2',
    name: 'Михаил Иванов',
    email: 'mikhail.ivanov@business.com',
    company: 'Business Analytics',
    avatarId: 'img-avatar-2',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  }
};

const mockImages: Record<string, Image> = {
  'img-banner-1': {
    id: 'img-banner-1',
    filename: 'banner-special-offer.jpg',
    originalName: 'special-offer-banner.jpg',
    mimeType: 'image/jpeg',
    size: 245760,
    url: '/images/banner-special-offer.jpg',
    createdAt: new Date('2024-01-01')
  },
  'img-offer-1': {
    id: 'img-offer-1',
    filename: 'offer-fast-shops.jpg',
    originalName: 'fast-shops-offer.jpg',
    mimeType: 'image/jpeg',
    size: 189440,
    url: '/images/offer-fast-shops.jpg',
    createdAt: new Date('2024-01-01')
  },
  'img-offer-2': {
    id: 'img-offer-2',
    filename: 'offer-premium-ratings.jpg',
    originalName: 'premium-ratings-offer.jpg',
    mimeType: 'image/jpeg',
    size: 201728,
    url: '/images/offer-premium-ratings.jpg',
    createdAt: new Date('2024-01-01')
  },
  'img-offer-3': {
    id: 'img-offer-3',
    filename: 'offer-express-audit.jpg',
    originalName: 'express-audit-offer.jpg',
    mimeType: 'image/jpeg',
    size: 175360,
    url: '/images/offer-express-audit.jpg',
    createdAt: new Date('2024-01-01')
  },
  'img-avatar-1': {
    id: 'img-avatar-1',
    filename: 'avatar-anna.jpg',
    originalName: 'anna-avatar.jpg',
    mimeType: 'image/jpeg',
    size: 45632,
    url: '/images/avatar-anna.jpg',
    createdAt: new Date('2024-01-01')
  },
  'img-avatar-2': {
    id: 'img-avatar-2',
    filename: 'avatar-mikhail.jpg',
    originalName: 'mikhail-avatar.jpg',
    mimeType: 'image/jpeg',
    size: 52304,
    url: '/images/avatar-mikhail.jpg',
    createdAt: new Date('2024-01-01')
  }
};

export const getBanner = (req: Request, res: Response): void => {
  try {
    const response: ApiResponse<Banner> = {
      success: true,
      data: mockBanner
    };
    
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: {
        message: 'Failed to fetch banner data',
        statusCode: 500
      }
    };
    res.status(500).json(response);
  }
};

export const getOffers = (req: Request, res: Response): void => {
  try {
    const { isFavourite, isPromo, authorId, active } = req.query;
    
    let filteredOffers = [...mockOffers];
    
    // Фильтрация по избранным
    if (isFavourite === 'true') {
      filteredOffers = filteredOffers.filter(offer => offer.isFavourite);
    }
    
    // Фильтрация по промо
    if (isPromo === 'true') {
      filteredOffers = filteredOffers.filter(offer => offer.isPromo);
    } else if (isPromo === 'false') {
      filteredOffers = filteredOffers.filter(offer => !offer.isPromo);
    }
    
    // Фильтрация по автору
    if (authorId) {
      filteredOffers = filteredOffers.filter(offer => offer.authorId === authorId);
    }
    
    // Фильтрация по активности (по умолчанию показываем только активные)
    if (active !== 'false') {
      const now = new Date();
      filteredOffers = filteredOffers.filter(offer => 
        offer.isActive && 
        offer.startDate <= now && 
        offer.endDate >= now
      );
    }
    
    const response: ApiResponse<Offer[]> = {
      success: true,
      data: filteredOffers
    };
    
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: {
        message: 'Failed to fetch offers',
        statusCode: 500
      }
    };
    res.status(500).json(response);
  }
};

export const getOfferById = (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    
    if (!id) {
      const response: ApiResponse = {
        success: false,
        error: {
          message: 'Offer ID is required',
          statusCode: 400
        }
      };
      res.status(400).json(response);
      return;
    }

    const offer = mockOffers.find(o => o.id === id);
    
    if (!offer) {
      const response: ApiResponse = {
        success: false,
        error: {
          message: 'Offer not found',
          statusCode: 404
        }
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse<Offer> = {
      success: true,
      data: offer
    };
    
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: {
        message: 'Failed to fetch offer',
        statusCode: 500
      }
    };
    res.status(500).json(response);
  }
};

export const getAuthorById = (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    
    if (!id) {
      const response: ApiResponse = {
        success: false,
        error: {
          message: 'Author ID is required',
          statusCode: 400
        }
      };
      res.status(400).json(response);
      return;
    }

    const author = mockAuthors[id];
    
    if (!author) {
      const response: ApiResponse = {
        success: false,
        error: {
          message: 'Author not found',
          statusCode: 404
        }
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse<Author> = {
      success: true,
      data: author
    };
    
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: {
        message: 'Failed to fetch author',
        statusCode: 500
      }
    };
    res.status(500).json(response);
  }
};

export const getPromoOffers = (req: Request, res: Response): void => {
  try {
    // Фильтруем только промо-предложения и активные по датам
    const now = new Date();
    const promoOffers = mockOffers.filter(offer => 
      offer.isPromo && 
      offer.isActive && 
      offer.startDate <= now && 
      offer.endDate >= now
    );
    
    const response: ApiResponse<Offer[]> = {
      success: true,
      data: promoOffers
    };
    
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: {
        message: 'Failed to fetch promo offers',
        statusCode: 500
      }
    };
    res.status(500).json(response);
  }
};

export const getImageById = (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    
    if (!id) {
      const response: ApiResponse = {
        success: false,
        error: {
          message: 'Image ID is required',
          statusCode: 400
        }
      };
      res.status(400).json(response);
      return;
    }

    const image = mockImages[id];
    
    if (!image) {
      const response: ApiResponse = {
        success: false,
        error: {
          message: 'Image not found',
          statusCode: 404
        }
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse<Image> = {
      success: true,
      data: image
    };
    
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: {
        message: 'Failed to fetch image',
        statusCode: 500
      }
    };
    res.status(500).json(response);
  }
};
