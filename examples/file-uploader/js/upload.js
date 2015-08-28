const Type = require('union-type');

const map = require('ramda/src/map')
    , reduce = require('ramda/src/reduce')
    , curry  = require('ramda/src/curry')
    , contains  = require('ramda/src/contains')
    , always  = require('ramda/src/always')
    , merge  = require('ramda/src/merge')
    , evolve  = require('ramda/src/evolve')
;

const h = require('snabbdom/h')
    , s = require('./svg');

const noop = function(){};

// model

const init = (files) => {
  return {
    status: 'initial',
    progress: {},
    abort: noop,
    title: (files.length === 1 
              ? files[0].name 
              : '(' + files.length + ' files)' ),
    files: map(initFile, files)
  }
}

const initFile = ({name,lastModifiedDate,size,type}) => {
  return {name,lastModifiedDate,size,type}
}

const statusLabel = (model) => {
  return {
    'initial': null,
    'uploading': 'uploading',
    'processing': 'processing',
    'uploaded': 'done',
    'error': 'error',
    'abort': 'stopped' 
  }[model.status] || null ;
}

const actionLabel = (action) => {
  return {
    'abort': 'stop'
  }[action] || null ;
}

const size = (model) => {
  return reduce( (tot,file) => tot + (file.size || 0), 0, model.files );
}

const status = curry( (s, model) => model.status == s );
const uploading = status('uploading');

const aborted = (model) => {
  return model.status == 'aborted';
}

const abortable = (model) => {
  return !!model.abort && contains(model.status, ['uploading']);
}

const hasProgressData = (x) => {
  return !(x.loaded === undefined || x.total === undefined);
}

const percentProgress = (p) => {
  if (!hasProgressData(p)) return null;
  return p.loaded / p.total;
}


// action

// NOTE: no async tasks initiated, so all updates simply return changed state

const Action = Type({
  Progress: [Function, hasProgressData],
  Uploaded: [],
  Error: [],
  Abort: []
});

const update = Action.caseOn({
  Progress: (abort,{loaded,total},model) => {
    return evolve({ status:   always(loaded < total ? 'uploading' : 'processing'),
                    progress: always({loaded, total}),
                    abort:  always(abort)
                 })(model);
  },
  Uploaded: evolve({status: always('uploaded')}),
  Error:    evolve({status: always('error')}),
  Abort:    evolve({status: always('abort')})
});


// view

const view = curry( ({progress},model) => {
  progress = merge({width: 200, height: 20}, progress || {});
  
  return (
    h('div', { attrs: { 'class': 'upload ' + model.status } },  [
      h('div.title',     [ renderTitle(model)             ]),
      h('div.progress',  [ renderProgress(model,progress) ]),
      h('div.status',    [ renderStatus(model)            ]),
      h('div.abort',     [ renderAbort(model)             ])
    ])
  );

});

function renderTitle(model){
  const titlespan = h('span.title', {}, model.title);
  const sizespan = h('span.size', {}, '' + size(model));  // TODO readable bytesize
  return (
    model.url
      ?  h('a', { attrs: {'href': model.url,
                          'target': '_blank'
                         } 
                }, [ titlespan, sizespan ])

      :  h('span', {}, [ titlespan, sizespan]) 
  );
}

function renderProgress(model,specs){
  const barwidth = percentProgress(model.progress) * specs.width;
  const linespecs = { x1: specs.width, x2: specs.width,
                      y1: 0,           y2: specs.height };

  const rect = (
    s('rect', { attrs: { height: specs.height,
                         width: barwidth,
                         class: 'bar'
                       }
              })
  );

  const line = (
    s('line', { attrs: merge(linespecs, {class: 'end'}) } )
  );

  return (
    s('svg', {attrs: specs}, [
      s('g', {}, (barwidth > 0) ? [rect,line] : [])
     ])       
  );

}

function renderStatus(model){
  const label = statusLabel(model);
  return h('span', {}, label);
}


function renderAbort(model){
  const label = actionLabel('abort');
  return h('a', { style: visible(abortable, model),
                  on: { click: model.abort } }, 
                label
          );
}

function visible(pred,model){
  return { display: pred(model) ? null : 'none' }
}


module.exports = {init, Action, update, view};


