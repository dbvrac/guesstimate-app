import React, {Component, PropTypes} from 'react'

import $ from 'jquery'
import {EditorState, Editor, ContentState, Modifier, CompositeDecorator} from 'draft-js'

import {isData, formatData} from 'lib/guesstimator/formatter/formatters/Data'
import {getFactParams, addText} from 'lib/factParser'

const NOUN_REGEX = /(\@[\w]+)/g
const PROPERTY_REGEX = /[a-zA-Z_](\.[\w]+)/g

const positionDecorator = (start, end, component) => ({strategy: (contentBlock, callback) => {callback(start, end)}, component})

const NounSpan = props => <span {...props} className='noun'>{props.children}</span>
const PropertySpan = props => <span {...props} className='property'>{props.children}</span>
const SuggestionSpan = props => <span {...props} className='suggestion'>{props.children}</span>

function findWithRegex(regex, contentBlock, callback) {
  const text = contentBlock.getText()
  let matchArr, start
  while ((matchArr = regex.exec(text)) !== null) {
    start = matchArr.index + matchArr[0].indexOf(matchArr[1])
    callback(start, start + matchArr[1].length)
  }
}

const STATIC_DECORATOR_LIST = [
  {
    strategy: (contentBlock, callback) => { findWithRegex(NOUN_REGEX, contentBlock, callback) },
    component: NounSpan,
  },
  {
    strategy: (contentBlock, callback) => { findWithRegex(PROPERTY_REGEX, contentBlock, callback) },
    component: PropertySpan,
  },
]
const STATIC_DECORATOR = {decorator: new CompositeDecorator(STATIC_DECORATOR_LIST)}

export default class TextInput extends Component{
  displayName: 'Guesstimate-TextInput'

  state = {
    editorState: EditorState.createWithContent(ContentState.createFromText(this.props.value || ''), new CompositeDecorator(STATIC_DECORATOR_LIST)),
    suggestion: '',
  }

  static propTypes = {
    value: PropTypes.string,
  }

  focus() { this.refs.editor.focus() }

  insertAtCaret(text) {
    this.onChange(EditorState.set(addText(this.state.editorState, text, false), STATIC_DECORATOR))
  }

  replaceAtCaret(text, start, end) {
    this.onChange(EditorState.set(addText(this.state.editorState, text, false, start, end), STATIC_DECORATOR))
  }

  componentWillUnmount() {
    const selection = this.state.editorState.getSelection()
    if (selection && selection.getHasFocus()) {
      this.props.onBlur()
    }
  }

  withSuggestion(baseEditorState, cursorPosition, precedingPartial, suggestion, nextWord, decoratorComponent) {
    const nextWordSuitable = [this.state.suggestion || '', suggestion || ''].includes(nextWord || '')
    const hasPartialAndSuggestion = !(_.isEmpty(precedingPartial) || _.isEmpty(suggestion))
    if (!(hasPartialAndSuggestion && nextWordSuitable)) { return {} }

    const decorator = new CompositeDecorator([
      positionDecorator(cursorPosition-precedingPartial.length-1, cursorPosition, decoratorComponent),
      positionDecorator(cursorPosition, cursorPosition+suggestion.length, SuggestionSpan),
      ...STATIC_DECORATOR_LIST
    ])

    const editorState = EditorState.set(addText(baseEditorState, suggestion, true, cursorPosition, cursorPosition+nextWord.length-1), {decorator})
    return {editorState, suggestion}
  }


  suggestionState(editorState) {
    const cursorPosition = editorState.getSelection().getFocusOffset()
    const text = editorState.getCurrentContent().getPlainText('')
    const prevWord = text.slice(0, cursorPosition).split(/[^\w@\.]/).pop()

    if (!(prevWord.startsWith('@') && editorState.getSelection().isCollapsed())) { return {} }

    const {propertyIndex, partialProperty, partialNoun, suggestion} = getFactParams(prevWord)

    const nextWord = text.slice(cursorPosition).split(/[^\w]/)[0]
    if (_.isEmpty(suggestion) && !_.isEmpty(this.state.suggestion) && nextWord === this.state.suggestion) {
      const noSuggestion = addText(editorState, '', true, cursorPosition, cursorPosition + this.state.suggestion.length)
      return {editorState: EditorState.set(noSuggestion, STATIC_DECORATOR)}
    } else if (prevWord.includes('.')) {
      return {isNoun: false, ...this.withSuggestion(editorState, cursorPosition, partialProperty, suggestion, nextWord, PropertySpan)}
    } else {
      return {isNoun: true, ...this.withSuggestion(editorState, cursorPosition, partialNoun, suggestion, nextWord, NounSpan)}
    }
  }

  onChange(editorState) {
    const newState = {
      suggestion: '',
      editorState: EditorState.set(editorState, STATIC_DECORATOR),
      ...this.suggestionState(editorState),
    }
    this.setState(newState)

    const text = newState.editorState.getCurrentContent().getPlainText('')
    if (text === this.props.value) { return }
    if (isData(text)) {
      this.props.onChangeData(formatData(text))
    } else {
      this.props.onChange(text)
    }
  }

  handleTab(e){
    const {suggestion, isNoun} = this.state

    if (!_.isEmpty(suggestion)) {
      const cursorPosition = this.state.editorState.getSelection().getFocusOffset()
      this.replaceAtCaret(suggestion + (isNoun ? '.' : ''), cursorPosition, cursorPosition+suggestion.length - 1)
    } else {
      this.props.onTab(e.shiftKey)
    }
    this.setState({suggestion: ''})
    e.preventDefault()
  }

  handleFocus() {
    $(window).on('functionMetricClicked', (_, {readableId}) => {this.insertAtCaret(readableId)})
    this.props.onFocus()
  }

  handleBlur() {
    $(window).off('functionMetricClicked')
    this.props.onBlur()
  }

  render() {
    const [{hasErrors, width, value}, {editorState}] = [this.props, this.state]
    const className = `TextInput ${width}` + (_.isEmpty(value) && hasErrors ? ' hasErrors' : '')
    return (
      <span
        className={className}
        onClick={this.focus.bind(this)}
        onKeyDown={e => {e.stopPropagation()}}
        onFocus={this.handleFocus.bind(this)}
      >
        <Editor
          onFocus={this.props.onFocus}
          onEscape={this.props.onEscape}
          editorState={editorState}
          handleReturn={e => this.props.onReturn(e.shiftKey)}
          onTab={this.handleTab.bind(this)}
          onBlur={this.handleBlur.bind(this)}
          onChange={this.onChange.bind(this)}
          ref='editor'
          placeholder={'value'}
        />
      </span>
    )
  }
}
