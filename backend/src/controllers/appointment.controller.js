import * as appointmentService from '../services/appointment.service.js';
import { ApiError } from '../utils/ApiError.js';

export async function getAvailableSlots(req, res, next) {
  try {
    const { doctorId, date } = req.query;
    if (!doctorId || !date) {
      throw new ApiError(400, 'doctorId and date query parameters are required.');
    }
    const data = await appointmentService.getAvailableSlots(doctorId, date);
    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
}

export async function bookAppointment(req, res, next) {
  try {
    const result = await appointmentService.bookAppointment(req.body, req.user?.id || null);
    res.status(201).json({
      success: true,
      data: result,
      message: 'Appointment booked successfully. Your token has been generated.',
    });
  } catch (err) {
    next(err);
  }
}

export async function registerWalkInToken(req, res, next) {
  try {
    const result = await appointmentService.registerWalkInToken(req.body, req.user?.id || null);
    res.status(201).json({
      success: true,
      data: result,
      message: 'Walk-in token registered successfully.',
    });
  } catch (err) {
    next(err);
  }
}

export async function lookupAppointment(req, res, next) {
  try {
    const reference = req.body?.reference || req.query?.reference;
    const phone = req.body?.phone || req.query?.phone;
    if (!reference || !phone) {
      throw new ApiError(400, 'Both reference number and contact phone number are required.');
    }
    const appointment = await appointmentService.lookupAppointment(reference, phone);
    res.json({
      success: true,
      data: appointment,
    });
  } catch (err) {
    next(err);
  }
}

export async function getAppointments(req, res, next) {
  try {
    const result = await appointmentService.getAppointments(req.query);
    res.json({
      success: true,
      data: result.items,
      pagination: result.pagination,
      summary: result.summary,
    });
  } catch (err) {
    next(err);
  }
}

export async function getAppointmentById(req, res, next) {
  try {
    const appointment = await appointmentService.getAppointmentById(req.params.id);
    res.json({
      success: true,
      data: appointment,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateAppointmentStatus(req, res, next) {
  try {
    const { status, reason } = req.body;
    if (!status) {
      throw new ApiError(400, 'status is required.');
    }
    const result = await appointmentService.updateAppointmentStatus(
      req.params.id,
      status,
      reason,
      req.user?.id || null
    );
    res.json({
      success: true,
      data: result,
      message: `Appointment status updated to ${status}.`,
    });
  } catch (err) {
    next(err);
  }
}

export async function assignEmergencyPriority(req, res, next) {
  try {
    const { priorityLevel, reason } = req.body;
    if (!priorityLevel) {
      throw new ApiError(400, 'priorityLevel is required.');
    }
    const result = await appointmentService.assignEmergencyPriority(
      req.params.id,
      priorityLevel,
      reason,
      req.user?.id || null
    );
    res.json({
      success: true,
      data: result,
      message: `Priority updated to ${priorityLevel}.`,
    });
  } catch (err) {
    next(err);
  }
}

export async function rescheduleAppointment(req, res, next) {
  try {
    const { newDate, newTime, reason } = req.body;
    if (!newDate || !newTime) {
      throw new ApiError(400, 'newDate and newTime are required.');
    }
    const result = await appointmentService.rescheduleAppointment(
      req.params.id,
      newDate,
      newTime,
      reason,
      req.user?.id || null
    );
    res.json({
      success: true,
      data: result,
      message: 'Appointment rescheduled successfully.',
    });
  } catch (err) {
    next(err);
  }
}

export async function callNextPatient(req, res, next) {
  try {
    const { doctorId, date } = req.body;
    if (!doctorId) {
      throw new ApiError(400, 'doctorId is required.');
    }
    const result = await appointmentService.callNextPatient(
      doctorId,
      date || null,
      req.user?.id || null
    );
    res.json({
      success: true,
      data: result,
      message: result.callingToken
        ? `Token ${result.callingToken.token_display} called for Room ${result.callingToken.room_number || ''}.`
        : 'No waiting patients in queue.',
    });
  } catch (err) {
    next(err);
  }
}

export async function getWaitingRoomDisplayQueue(req, res, next) {
  try {
    const date = req.query.date || null;
    const data = await appointmentService.getWaitingRoomDisplayQueue(date);
    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
}

export async function getTodayQueue(req, res, next) {
  try {
    const { doctorId, date } = req.query;
    const data = await appointmentService.getTodayQueue(doctorId || null, date || null);
    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
}

export async function getAppointmentStatsSummary(req, res, next) {
  try {
    const date = req.query.date || null;
    const data = await appointmentService.getAppointmentStatsSummary(date);
    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
}
