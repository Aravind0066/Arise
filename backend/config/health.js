function getHealthState() {
  return {
    status: 'healthy',
    backendStatus: 'available',
    database: 'not used; player data is stored locally on the device',
  };
}

module.exports = { getHealthState };
