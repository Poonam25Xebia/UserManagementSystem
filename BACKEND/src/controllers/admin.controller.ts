import { Request, Response } from 'express';
import { EmailDispatchService } from '../services/email-dispatch.service';
import { UserNotFoundException, AccountNotPendingException } from '../errors/registration.errors';

export class AdminController {
  constructor(private readonly emailDispatchService: EmailDispatchService) {}

  async resendConfirmation(req: Request, res: Response): Promise<void> {
    const userId = req.params.user_id as string;

    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      res.status(400).json({ error: 'User ID is required.' });
      return;
    }

    try {
      await this.emailDispatchService.resendConfirmation(userId.trim());
      res.status(202).json({ message: 'Confirmation email enqueue requested.' });
    } catch (err) {
      if (err instanceof UserNotFoundException) {
        res.status(404).json({ error: 'User not found.' });
      } else if (err instanceof AccountNotPendingException) {
        res.status(409).json({ error: 'Account is not pending activation.' });
      } else {
        console.error('[AdminController] Unexpected error:', err);
        res.status(500).json({ error: 'An unexpected error occurred.' });
      }
    }
  }
}
