// Get Site nameId to generate Model names
const getSiteNameId = async(siteId) => {
  const siteQuery = new Parse.Query('Site');
  siteQuery.equalTo('objectId', siteId);
  const siteRecord = await siteQuery.first({useMasterKey: true});
  if (!siteRecord || !siteRecord.get('nameId')) return null;
  return siteRecord.get('nameId');
}

Parse.Cloud.define("generateTicket", async request => {
  const {email, siteId} = request.params;
  if (!email)
    return { status: 'error', message: 'There is no email param!' };
  
  // get site name Id and generate MODEL names based on that
  const siteNameId = await getSiteNameId(siteId);
  if (siteNameId === null) return { status: 'error', message: 'Invalid siteId' };

  const PARTTICIPANT_MODEL = `ct____${siteNameId}____Participant`;

  const participantQuery = new Parse.Query(PARTTICIPANT_MODEL);
  participantQuery.equalTo('Email', email);
  const currentParticipant = await participantQuery.find({useMasterKey: true});
  if (!currentParticipant || currentParticipant.length < 1) 
    return { status: 'error', message: 'There is no participant with the given email!' };

  // If the record already has ticket information, no need to regenerate again.
  if (currentParticipant[0].get('ticket')) return currentParticipant[0].get('ticket');

  // generate the ticket, currently in order
  const countQuery = new Parse.Query(PARTTICIPANT_MODEL);
  countQuery.equalTo('t__status', 'Published');
  countQuery.exists('ticket');
  const count = await countQuery.count({useMasterKey: true});
  
  const newTicketNumber = ('000000' + (count + 1)).slice(-6);

  for (let i = 0; i < currentParticipant.length; i++) {
    currentParticipant[i].set('ticket', newTicketNumber);
    await currentParticipant[i].save();
  }

  return { status: 'success', ticket: newTicketNumber };
});

const claimPoints = async (code, participant, siteId) => {
  if (!code || !participant)
    return { status: 'error', message: 'Insufficient Data!' };
  
  // get site name Id and generate MODEL names based on that
  const siteNameId = await getSiteNameId(siteId);
  if (siteNameId === null) return { status: 'error', message: 'Invalid siteId' };
  const PARTTICIPANT_MODEL = `ct____${siteNameId}____Participant`;
  const CHALLENGE_MODEL = `ct____${siteNameId}____Challenge`;

  const challengeQuery = new Parse.Query(CHALLENGE_MODEL);
//  challengeQuery.equalTo('t__status', 'Published');
  challengeQuery.equalTo('Enabled', true);
  challengeQuery.equalTo('Code', code);
  const currentChallenge = await challengeQuery.find({useMasterKey: true});
  if (!currentChallenge || currentChallenge.length < 1)
    return { status: 'error', message: 'There is no challenge with the given code!' };

  const participantQuery = new Parse.Query(PARTTICIPANT_MODEL);
  // participantQuery.equalTo('t__status', 'Published');
  participantQuery.equalTo('Email', participant);
  const currentParticipant = await participantQuery.find({useMasterKey: true});
  if (!currentParticipant || currentParticipant.length < 1) 
    return { status: 'error', message: 'There is no participant with the given email!' };

  
  // check if participant already claim points of this challenge
  const redeemList = currentChallenge[0].get('Redeem_List') || [];
  const redeemIndex = redeemList.findIndex(participant => participant.id === currentParticipant[0].id);

  // If no previous claim record of the participant, increase the points and append participant to redeem list
  if (redeemIndex === -1 || currentChallenge[0].get('Redeem_Once') === false) {
    const pointsToAdd = currentChallenge[0].get('Points');
    for (i = 0; i < currentParticipant.length; i++) {
      currentParticipant[i].set('Points', currentParticipant[i].get('Points') + pointsToAdd);
      await currentParticipant[i].save();
    }

    for (i = 0; i < currentChallenge.length; i++) {
      currentChallenge[i].set('Redeem_List', [...redeemList, ...currentParticipant]);
      await currentChallenge[i].save();
    }
    return { status: 'success', point: pointsToAdd };
  }

  return { status: 'success', point: 0 };
}
module.exports.claimPoints = claimPoints;

Parse.Cloud.define("claimPoints", async request => {
  let i;
  const {code, participant, siteId} = request.params;
  const result = await claimPoints(code, participant, siteId);
  return result;
});





