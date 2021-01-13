const PARTTICIPANT_MODEL = 'ct____alfred_40gmail_2ecom__Mural_Conference____Participant';
const CHALLENGE_MODEL = 'ct____alfred_40gmail_2ecom__Mural_Conference____Challenge';

Parse.Cloud.define("generateTicket", async request => {
  const {email} = request.params;
  if (!email)
    throw 'There is no email param!';
  const participantQuery = new Parse.Query(PARTTICIPANT_MODEL);
  participantQuery.equalTo('t__status', 'Published');
  participantQuery.equalTo('Email', email);
  const currentParticipant = await participantQuery.first({useMasterKey: true});
  if (!currentParticipant) 
    throw 'There is no participant with the given email!';

  // If the record already has ticket information, no need to regenerate again.
  if (currentParticipant.get('ticket')) return currentParticipant.get('ticket');

  // generate the ticket, currently in order
  const countQuery = new Parse.Query(PARTTICIPANT_MODEL);
  countQuery.equalTo('t__status', 'Published');
  countQuery.exists('ticket');
  const count = await countQuery.count({useMasterKey: true});
  
  const newTicketNumber = ('000000' + (count + 1)).slice(-6);

  currentParticipant.set('ticket', newTicketNumber);
  await currentParticipant.save({useMasterKey: true});

  return newTicketNumber;
});


Parse.Cloud.define("claimPoints", async request => {
  const {code, participant} = request.params;
  if (!code || !participant)
    throw 'Insufficient Data!';
  const challengeQuery = new Parse.Query(CHALLENGE_MODEL);
  challengeQuery.equalTo('t__status', 'Published');
  challengeQuery.equalTo('Enabled', true);
  challengeQuery.equalTo('Code', code);
  const currentChallenge = await challengeQuery.first({useMasterKey: true});
  if (!currentChallenge)
    throw 'There is no challenge with the given code!';

  const participantQuery = new Parse.Query(PARTTICIPANT_MODEL);
  participantQuery.equalTo('t__status', 'Published');
  participantQuery.equalTo('Email', participant);
  const currentParticipant = await participantQuery.first({useMasterKey: true});
  if (!currentParticipant) 
    throw 'There is no participant with the given email!';

  currentParticipant.set('Points', currentParticipant.get('Points') + currentChallenge.get('Points'))
  await currentParticipant.save({useMasterKey: true});
});