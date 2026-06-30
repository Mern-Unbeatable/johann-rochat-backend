import { config } from '../../config/config.js';
import { Logger } from '../../config/logger.js';
import { catchAsync } from '../../shared/globals/decorators/catch-async.js';
import { ResponseHandler } from '../../shared/globals/helpers/response.handler.js';
import { userService } from './user.services.js';
import { updateProfileSchema, adjustCreditsSchema, setVerifiedSchema } from './user.validation.js';

class UserController {
  constructor() {
    this.log = new Logger('UserController');
  }


  getMe = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const user = await userService.getFullProfile(userId);
    if (!user) throw new Error('User not found');

    ResponseHandler.success(res, {
      message: 'Profile fetched successfully',
      data: { user },
    });
  });

  getMyStats = catchAsync(async (req, res) => {
    const userId = req.user.id;
    this.log.info(`Fetching stats for user: ${userId}`);

    const stats = await userService.getUserStats(userId);

    ResponseHandler.success(res, {
      message: 'User statistics fetched successfully',
      data: { stats },
    });
  });
  getMyCreditHistory = catchAsync(async (req, res) => {
    const userId = req.user.id;
    this.log.info(`Fetching credit history for user: ${userId}`);

    const result = await userService.getCreditHistory(userId, req.query);

    ResponseHandler.success(res, {
      message: 'Credit history fetched successfully',
      data: result,
    });
  });

  updateProfile = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { firstName, lastName } = updateProfileSchema.parse(req.body);

    this.log.info(`Updating profile for user: ${userId}`);
    let name;
    if (firstName !== undefined || lastName !== undefined) {
      const current = await userService.getUserById(userId);
      const parts = (current?.name ?? '').split(' ');
      const currentFirst = parts[0] ?? '';
      const currentLast = parts.slice(1).join(' ') ?? '';
      name = `${(firstName ?? currentFirst).trim()} ${(lastName ?? currentLast).trim()}`.trim();
    }

    const updated = await userService.updateProfile(userId, { name });

    ResponseHandler.updated(res, {
      message: 'Profile updated successfully',
      data: { user: updated },
    });
  });
  deleteMe = catchAsync(async (req, res) => {
    const userId = req.user.id;
    this.log.info(`Self-delete for user: ${userId}`);

    await userService.deleteUser(userId);

    const cookieOptions = {
      httpOnly: true,
      secure: config.NODE_ENV !== 'development',
      sameSite: 'lax',
      path: '/',
    };
    res.clearCookie('accessToken', cookieOptions);
    res.clearCookie('refreshToken', cookieOptions);
    res.clearCookie('userSession', cookieOptions);

    ResponseHandler.success(res, {
      message: 'Your account has been deleted successfully',
      data: { deletedAt: new Date().toISOString() },
    });
  });


  getAllUsers = catchAsync(async (req, res) => {
    this.log.info('Admin: fetching all users');

    const result = await userService.getAllUsers(req.query);

    ResponseHandler.success(res, {
      message: 'Users fetched successfully',
      data: result,
    });
  });
  getAdminStats = catchAsync(async (_req, res) => {
    this.log.info('Admin: fetching user stats');

    const stats = await userService.getAdminUserStats();

    ResponseHandler.success(res, {
      message: 'User statistics fetched successfully',
      data: { stats },
    });
  });

  getUserById = catchAsync(async (req, res) => {
    const { id } = req.params;
    this.log.info(`Admin: fetching user ${id}`);

    const user = await userService.getUserWithDetails(id);
    if (!user) throw new Error('User not found');

    ResponseHandler.success(res, {
      message: 'User fetched successfully',
      data: { user },
    });
  });

  setUserVerified = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { isVerified } = setVerifiedSchema.parse(req.body);

    this.log.info(`Admin: set isVerified=${isVerified} for user ${id}`);

    const user = await userService.setVerified(id, isVerified);

    ResponseHandler.updated(res, {
      message: `User ${isVerified ? 'verified' : 'unverified'} successfully`,
      data: { user },
    });
  });
  adjustCredits = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { amount, type, reference } = adjustCreditsSchema.parse(req.body);

    this.log.info(
      `Admin: adjust credits for user ${id}: ${amount > 0 ? '+' : ''}${amount} (${type})`,
    );

    const result = await userService.adjustCredits(id, amount, type, reference);

    ResponseHandler.updated(res, {
      message: `Credits adjusted by ${amount > 0 ? '+' : ''}${amount} successfully`,
      data: result,
    });
  });


  deleteUser = catchAsync(async (req, res) => {
    const { id } = req.params;

    if (id === req.user.id) {
      throw new Error(
        'You cannot delete your own account via this endpoint. Use DELETE /me instead.',
      );
    }

    this.log.info(`Admin: deleting user ${id}`);

    const deleted = await userService.deleteUser(id);

    ResponseHandler.success(res, {
      message: 'User deleted successfully',
      data: { userId: deleted.id, deletedAt: new Date().toISOString() },
    });
  });

r
  refreshUserCredits = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('credits email name role');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          credits: user.credits
        }
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
// Add to UserController class
assignPackage = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { packageId } = req.body;
  
  this.log.info(`Admin: assigning package ${packageId} to user ${id}`);
  
  const user = await userService.assignPackage(id, packageId);
  
  ResponseHandler.updated(res, {
    message: 'Package assigned successfully',
    data: { user },
  });
});

addCreditsOnly = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { amount, reference } = req.body;
  
  this.log.info(`Admin: adding ${amount} credits to user ${id}`);
  
  const user = await userService.addCreditsOnly(id, amount, reference);
  
  ResponseHandler.updated(res, {
    message: `${amount} credits added successfully`,
    data: { user },
  });
});


}

export const userController = new UserController();
export { UserController };
