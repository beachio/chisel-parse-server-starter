const PARTTICIPANT_MODEL = 'ct____alfred_40gmail_2ecom__Mural_Conference____Participant';
const CHALLENGE_MODEL = 'ct____alfred_40gmail_2ecom__Mural_Conference____Challenge';

Parse.Cloud.define("generateTicket", async request => {
  const {email} = request.params;
  if (!email)
    throw 'There is no email param!';
  const participantQuery = new Parse.Query(PARTTICIPANT_MODEL);
  participantQuery.equalTo('Email', email);
  const currentParticipant = await participantQuery.find({useMasterKey: true});
  if (!currentParticipant || currentParticipant.length < 1) 
    throw 'There is no participant with the given email!';

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
    await currentParticipant[i].save({useMasterKey: true});
  }

  return newTicketNumber;
});


Parse.Cloud.define("claimPoints", async request => {
  let i;
  const {code, participant} = request.params;
  if (!code || !participant)
    throw 'Insufficient Data!';
  const challengeQuery = new Parse.Query(CHALLENGE_MODEL);
//  challengeQuery.equalTo('t__status', 'Published');
  challengeQuery.equalTo('Enabled', true);
  challengeQuery.equalTo('Code', code);
  const currentChallenge = await challengeQuery.find({useMasterKey: true});
  if (!currentChallenge || currentChallenge.length < 1)
    throw 'There is no challenge with the given code!';

  const participantQuery = new Parse.Query(PARTTICIPANT_MODEL);
  // participantQuery.equalTo('t__status', 'Published');
  participantQuery.equalTo('Email', participant);
  const currentParticipant = await participantQuery.find({useMasterKey: true});
  if (!currentParticipant || currentParticipant.length < 1) 
    throw 'There is no participant with the given email!';

  
  // check if participant already claim points of this challenge
  const redeemList = currentChallenge[0].get('Redeem_List') || [];
  const redeemIndex = redeemList.findIndex(participant => participant.id === currentParticipant[0].id);

  // If no previous claim record of the participant, increase the points and append participant to redeem list
  if (redeemIndex === -1) {
    for (i = 0; i < currentParticipant.length; i++) {
      currentParticipant[i].set('Points', currentParticipant[i].get('Points') + currentChallenge[0].get('Points'))
      await currentParticipant[i].save();
    }

    for (i = 0; i < currentChallenge.length; i++) {
      currentChallenge[i].set('Redeem_List', [...redeemList, ...currentParticipant]);
      await currentChallenge[i].save();
    }
  }
});