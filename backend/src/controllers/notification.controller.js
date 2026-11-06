import * as notificationService from '../services/notification.service.js';

export async function getNotifications(req, res, next) {
  try {
    const unreadOnly = req.query.unreadOnly === 'true';
    const limit = req.query.limit;
    const result = await notificationService.getNotifications({
      unreadOnly,
      limit,
      userId: req.user?.id,
    });
    res.json({
      success: true,
      data: result.items,
      unreadCount: result.unreadCount,
    });
  } catch (err) {
    next(err);
  }
}

export async function getUnreadCount(req, res, next) {
  try {
    const count = await notificationService.getUnreadCount(req.user?.id);
    res.json({
      success: true,
      unreadCount: count,
    });
  } catch (err) {
    next(err);
  }
}

export async function markAsRead(req, res, next) {
  try {
    const result = await notificationService.markAsRead(req.params.id);
    res.json({
      success: true,
      data: result,
      message: 'Notification marked as read.',
    });
  } catch (err) {
    next(err);
  }
}

export async function markAllAsRead(req, res, next) {
  try {
    const result = await notificationService.markAllAsRead(req.user?.id);
    res.json({
      success: true,
      data: result,
      message: 'All notifications marked as read.',
    });
  } catch (err) {
    next(err);
  }
}
