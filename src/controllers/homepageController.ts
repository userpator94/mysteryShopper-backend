import { Request, Response } from 'express';
import { ApiResponse, Banner, Offer, Image, Author } from '../types';
import { dbService } from '../services/databaseService';


export const getBanner = async (req: Request, res: Response): Promise<void> => {
  try {
    const banner = await dbService.getBanner();
    
    if (!banner) {
      const response: ApiResponse = {
        success: false,
        error: {
          message: 'Banner not found',
          statusCode: 404
        }
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse<Banner> = {
      success: true,
      data: banner
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error fetching banner:', error);
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

export const getOffers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { isFavourite, isPromo, authorId, active } = req.query;
    
    const filters = {
      isFavourite: isFavourite === 'true' ? true : undefined,
      isPromo: isPromo === 'true' ? true : isPromo === 'false' ? false : undefined,
      authorId: authorId as string,
      active: active !== 'false'
    };

    const offers = await dbService.getOffersWithFilters(filters);
    
    const response: ApiResponse<Offer[]> = {
      success: true,
      data: offers
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error fetching offers:', error);
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

export const getOfferById = async (req: Request, res: Response): Promise<void> => {
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

    const offer = await dbService.getOfferById(id);
    
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
    console.error('Error fetching offer:', error);
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

export const getAuthorById = async (req: Request, res: Response): Promise<void> => {
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

    const author = await dbService.getEmployerById(id);
    
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
    console.error('Error fetching author:', error);
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

export const getPromoOffers = async (req: Request, res: Response): Promise<void> => {
  try {
    const promoOffers = await dbService.getPromoOffers();
    
    const response: ApiResponse<Offer[]> = {
      success: true,
      data: promoOffers
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error fetching promo offers:', error);
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

export const getImageById = async (req: Request, res: Response): Promise<void> => {
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

    const image = await dbService.getImageById(id);
    
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
    console.error('Error fetching image:', error);
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
