import * as doctorService from '../services/doctor.service.js';

export async function getDoctors(req, res, next) {
  try {
    const result = await doctorService.getDoctors(req.query);
    res.json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function getDoctorById(req, res, next) {
  try {
    const doctor = await doctorService.getDoctorById(req.params.id);
    res.json({
      success: true,
      data: doctor,
    });
  } catch (err) {
    next(err);
  }
}

export async function createDoctor(req, res, next) {
  try {
    const doctor = await doctorService.createDoctor(req.body, req.user?.id);
    res.status(201).json({
      success: true,
      data: doctor,
      message: 'Doctor created successfully.',
    });
  } catch (err) {
    next(err);
  }
}

export async function updateDoctor(req, res, next) {
  try {
    const doctor = await doctorService.updateDoctor(req.params.id, req.body, req.user?.id);
    res.json({
      success: true,
      data: doctor,
      message: 'Doctor updated successfully.',
    });
  } catch (err) {
    next(err);
  }
}

export async function uploadDoctorPhoto(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No photo file provided.' });
    }
    const photoUrl = `/uploads/doctors/${req.file.filename}`;
    const result = await doctorService.updateDoctorPhoto(req.params.id, photoUrl, req.user?.id);
    res.json({
      success: true,
      data: result,
      message: 'Doctor photograph uploaded successfully.',
    });
  } catch (err) {
    next(err);
  }
}

export async function removeDoctorPhoto(req, res, next) {
  try {
    const result = await doctorService.removeDoctorPhoto(req.params.id, req.user?.id);
    res.json({
      success: true,
      data: result,
      message: 'Doctor photograph removed successfully.',
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteDoctor(req, res, next) {
  try {
    const result = await doctorService.deleteDoctor(req.params.id, req.user?.id);
    res.json({
      success: true,
      data: result,
      message: 'Doctor deleted successfully.',
    });
  } catch (err) {
    next(err);
  }
}

export async function getDoctorSchedule(req, res, next) {
  try {
    const schedules = await doctorService.getDoctorSchedule(req.params.id);
    res.json({
      success: true,
      data: schedules,
    });
  } catch (err) {
    next(err);
  }
}

export async function saveDoctorSchedule(req, res, next) {
  try {
    const schedules = await doctorService.saveDoctorSchedule(req.params.id, req.body.schedules || req.body, req.user?.id);
    res.json({
      success: true,
      data: schedules,
      message: 'Doctor schedule updated successfully.',
    });
  } catch (err) {
    next(err);
  }
}

export async function getDoctorLeaves(req, res, next) {
  try {
    const result = await doctorService.getDoctorLeaves({
      doctorId: req.params.id || req.query.doctorId,
      status: req.query.status,
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function createDoctorLeave(req, res, next) {
  try {
    const leave = await doctorService.createDoctorLeave(req.body, req.user?.id);
    res.status(201).json({
      success: true,
      data: leave,
      message: 'Doctor leave applied successfully.',
    });
  } catch (err) {
    next(err);
  }
}

export async function updateDoctorLeaveStatus(req, res, next) {
  try {
    const result = await doctorService.updateDoctorLeaveStatus(req.params.id, req.body, req.user?.id);
    res.json({
      success: true,
      data: result,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
}

export async function getDepartments(req, res, next) {
  try {
    const departments = await doctorService.getDepartments();
    res.json({
      success: true,
      data: departments,
    });
  } catch (err) {
    next(err);
  }
}
