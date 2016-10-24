require('.')({

  greet: function ({name}) {
    return new Promise(resolve => resolve(`Hello, ${name || 'anon'}`))
  }

})
