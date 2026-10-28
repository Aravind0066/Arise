function getQuestStatus(quest, completedQuestIds = new Set()) {
  if (completedQuestIds.has(String(quest._id))) return 'completed';
  const deadline = new Date(quest.deadline).getTime();
  return Number.isNaN(deadline) || deadline < Date.now() ? 'expired' : 'active';
}

function withStatus(quest, completedQuestIds) {
  return { ...quest, status: getQuestStatus(quest, completedQuestIds) };
}

module.exports = { getQuestStatus, withStatus };
