import * as patientService from '../services/patient.service.js';

export async function getPatients(req, res, next) {
  try {
    const result = await patientService.getPatients(req.query);
    res.json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function getPatientById(req, res, next) {
  try {
    const patient = await patientService.getPatientById(req.params.id);
    res.json({
      success: true,
      data: patient,
    });
  } catch (err) {
    next(err);
  }
}

export async function createPatient(req, res, next) {
  try {
    const patient = await patientService.createPatient(req.body, req.user?.id);
    res.status(201).json({
      success: true,
      data: patient,
      message: 'Patient registered successfully.',
    });
  } catch (err) {
    next(err);
  }
}

export async function updatePatient(req, res, next) {
  try {
    const patient = await patientService.updatePatient(req.params.id, req.body, req.user?.id);
    res.json({
      success: true,
      data: patient,
      message: 'Patient updated successfully.',
    });
  } catch (err) {
    next(err);
  }
}

export async function deletePatient(req, res, next) {
  try {
    const result = await patientService.deletePatient(req.params.id, req.user?.id);
    res.json({
      success: true,
      data: result,
      message: 'Patient deleted successfully.',
    });
  } catch (err) {
    next(err);
  }
}

export async function getPatientPrescriptions(req, res, next) {
  try {
    const prescriptions = await patientService.getPatientPrescriptions(req.params.id);
    res.json({
      success: true,
      data: prescriptions,
    });
  } catch (err) {
    next(err);
  }
}
