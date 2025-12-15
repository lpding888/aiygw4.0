/**
 * 用户评价控制器
 */

import { Request, Response, NextFunction } from 'express';
import * as reviewsRepo from '../repositories/reviews.repo.js';

class ReviewsController {
  async listReviews(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, isFeatured, rating, limit = 50, offset = 0 } = req.query;
      const reviews = await reviewsRepo.listReviews({
        status: status as string,
        isFeatured: isFeatured === 'true' ? true : undefined,
        rating: rating ? parseInt(rating as string) : undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
      res.json({ success: true, data: { items: reviews, limit, offset } });
    } catch (error) {
      next(error);
    }
  }

  async getReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const review = await reviewsRepo.getReviewById(parseInt(req.params.id));
      if (!review) {
        res
          .status(404)
          .json({ success: false, error: { code: 'NOT_FOUND', message: '评价不存在' } });
        return;
      }
      res.json({ success: true, data: review });
    } catch (error) {
      next(error);
    }
  }

  async createReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const review = await reviewsRepo.createReview({ ...req.body, user_id: req.user?.id });
      res.status(201).json({ success: true, data: review });
    } catch (error) {
      next(error);
    }
  }

  async updateReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const review = await reviewsRepo.updateReview(parseInt(req.params.id), req.body);
      res.json({ success: true, data: review });
    } catch (error) {
      next(error);
    }
  }

  async deleteReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const deleted = await reviewsRepo.deleteReview(parseInt(req.params.id));
      if (!deleted) {
        res
          .status(404)
          .json({ success: false, error: { code: 'NOT_FOUND', message: '评价不存在' } });
        return;
      }
      res.json({ success: true, message: '已删除' });
    } catch (error) {
      next(error);
    }
  }

  async approveReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const review = await reviewsRepo.approveReview(parseInt(req.params.id));
      res.json({ success: true, data: review });
    } catch (error) {
      next(error);
    }
  }

  async replyToReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { reply } = req.body;
      const review = await reviewsRepo.replyToReview(parseInt(req.params.id), reply);
      res.json({ success: true, data: review });
    } catch (error) {
      next(error);
    }
  }

  async getApprovedReviews(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit = 20, featured } = req.query;
      const reviews = await reviewsRepo.getApprovedReviews({
        limit: parseInt(limit as string),
        isFeatured: featured === 'true'
      });
      res.json({ success: true, data: reviews });
    } catch (error) {
      next(error);
    }
  }

  async getAverageRating(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await reviewsRepo.getAverageRating();
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }
}

export default new ReviewsController();
