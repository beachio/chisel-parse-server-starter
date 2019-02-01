module.exports.CLOUD_ERROR_CODE__STRIPE_INIT_ERROR   = 701;

module.exports.promisifyW = pp => {
  return new Promise((rs, rj) => pp.then(rs, rs));
};

module.exports.getAllObjects = query => {
  const MAX_COUNT = 90;
  let objects = [];

  const getObjects = async (offset = 0) => {
    const res = await query
      .limit(MAX_COUNT)
      .skip(offset)
      .find({useMasterKey: true});

    if (!res.length)
      return objects;

    objects = objects.concat(res);
    return getObjects(offset + MAX_COUNT);
  };

  return getObjects();
};