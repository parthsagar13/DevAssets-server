const success = (res, data = null, message = 'Success', status = 200, meta = null) => {
	const payload = {
		success: true,
		message: message || 'Success',
		data: data === undefined ? null : data,
		timestamp: new Date().toISOString()
	};

	if (meta) payload.meta = meta;

	return res.status(status).json(payload);
};

const error = (res, message = 'Error', status = 500, errors = null) => {
	const payload = {
		success: false,
		message: message || 'Error',
		errors: errors || null,
		timestamp: new Date().toISOString()
	};

	return res.status(status).json(payload);
};

const paginated = (res, data = [], pagination = {}, message = 'Success', status = 200) => {
	const payload = {
		success: true,
		message,
		data,
		pagination,
		timestamp: new Date().toISOString()
	};

	return res.status(status).json(payload);
};

module.exports = {
	success,
	error,
	paginated
};
