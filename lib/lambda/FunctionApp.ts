

exports.handler = async (event:any) => {

  return {
    body: JSON.stringify(event, null, 2),
    headers: {
      'Content-Type': 'text/plain',
    },
    status: '200',
  };
}