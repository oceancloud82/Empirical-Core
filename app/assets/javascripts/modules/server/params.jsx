EC.modules.Params = function () {

  // data -> params
  this.process = function (id, resourceNamePlural, options) {
    return _.compose(
      _paramAdder2(_jsonData),
      _paramAdder(_contentType),
      _paramAdder(_dataType),
      _paramAdder(_callbackParam, options.callback),
      _paramAdder(_urlParam, id, resourceNamePlural, options.urlPrefix),
      _paramAdder(_typeParam, id),
      _paramAdder2(_paramsForForm),
      _dataIntoParam
    )
  }

  var _dataIntoParam = function (data) {return {data: data}}

  var _paramAdder = function (fn) {
    var hash = fn.apply(null, _.rest(arguments));
    return function (params) {
      var result = _.extend({}, params, hash)
      return result
    }
  }

  var _paramAdder2 = function (fn) {
    return function (params) {
      var hash = fn.apply(null, [params]);
      return _.extend({}, params, hash)
    }
  }

  var _defaultCallback = function (data) {console.log('ajax success');}
  var _callbackParam = function (callback) {
    var callback = (callback? callback : _defaultCallback)
    return {success: callback}
  }

  var _jsonData = function (params) {
    console.log('params', params)
    return {data: JSON.stringify(params.data)}
  }

  var _dataType = function () {
    return {dataType: 'json'}
  }

  var _contentType = function () {
    return {contentType: 'application/json'}
  }

  var _urlParam = function (id, resourceNamePlural, urlPrefix) {
    var suffix = id ? ('/' + id) : null;
    var url = [urlPrefix, '/', resourceNamePlural, suffix].join('');
    return {url: url}
  }

  var _typeParam = function (id) {
    var type = id ? 'PUT' : 'POST'
    return {type: type}
  }

  var _paramsForForm = function (params) {
    var extras
    var dataObj = params.data // data is of the form {resourceNameSingular: hash | FormData}
    if (dataObj instanceof FormData) {
      extras = {processData: false, contentType: false}
    } else {
      extras = {}
    }
    return extras;
  }
}