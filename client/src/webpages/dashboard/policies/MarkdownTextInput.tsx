import { mergeAttributes, wrappingInputRule } from '@tiptap/core';
import {
  ListItem,
  OrderedList,
  orderedListInputRegex,
} from '@tiptap/extension-list';
import { Editor, EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';

// Use the core deletion keymap for list items.
const PolicyListItem = ListItem.extend({
  addExtensions() {
    return [];
  },
});

// Preserve explicit list attributes and treat pasted numbered text as plain text.
const PolicyOrderedList = OrderedList.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      type: {
        default: null,
        parseHTML: (element) => element.getAttribute('type'),
      },
    };
  },
  renderHTML({ HTMLAttributes }) {
    const { start, ...attributesWithoutStart } = HTMLAttributes;
    return [
      'ol',
      mergeAttributes(
        this.options.HTMLAttributes,
        start === 1 ? attributesWithoutStart : HTMLAttributes,
      ),
      0,
    ];
  },
  addProseMirrorPlugins() {
    return [];
  },
  addInputRules() {
    return [
      wrappingInputRule({
        find: orderedListInputRegex,
        type: this.type,
        keepMarks: this.options.keepMarks,
        keepAttributes: this.options.keepAttributes,
        getAttributes: (match) => ({
          start: Number(match[1]),
          ...this.editor.getAttributes('textStyle'),
        }),
        joinPredicate: (match, node) =>
          node.childCount + node.attrs.start === Number(match[1]),
        editor: this.editor,
      }),
    ];
  },
});

export default function MarkdownTextInput(props: {
  text?: string;
  setText: (text: string) => void;
  title?: string | React.ReactNode;
  textSize?: 'small' | 'large';
  disabled?: boolean;
}) {
  const { text, setText, title, textSize = 'large', disabled = false } = props;

  const editorRef = useRef<Editor | null>(null);
  const editor: Editor | null = useEditor(
    {
      shouldRerenderOnTransaction: true,
      extensions: [
        StarterKit.configure({
          link: false,
          underline: false,
          listItem: false,
          listKeymap: false,
          trailingNode: false,
          codeBlock: { exitOnArrowUp: false },
          orderedList: false,
          bulletList: {
            keepMarks: true,
            keepAttributes: false, // TODO : Making this as `false` becase marks are not preserved when I try to preserve attrs, awaiting a bit of help
          },
        }),
        PolicyListItem,
        PolicyOrderedList.configure({
          keepMarks: true,
          keepAttributes: false,
        }),
      ],
      editorProps: {
        attributes: {
          class: `bg-white outline-none focus:outline-none w-full px-6 border-solid border inline-block mr-3 cursor-text py-4 border-slate-200 focus:border-slate-200 outline-0 placeholder-slate-300 text-slate-700 rounded min-h-48 max-h-96 overflow-y-scroll ${
            textSize === 'small' ? 'text-base px-3 py-2' : 'text-lg px-6 py-4'
          }`,
        },
      },
      content: `${text ?? ''}`,
      onUpdate: ({ editor }) => {
        // Update local state and parent state when content changes
        const newContent = editor.getHTML();

        setText(newContent);
      },
    },
    [],
  );

  // NB: This is needed because the editor only focuses when the user clicks on
  // the editor content, and not when the user clicks elsewhere in the editor.
  useLayoutEffect(() => {
    editorRef.current = editor;
  }, [editor]);
  const focusEditor = () => {
    if (editorRef.current && !disabled) {
      editorRef.current.commands.focus();
    }
  };

  useMemo(() => {
    editor?.setOptions({
      editable: !disabled,
      editorProps: {
        attributes: {
          class: `bg-white outline-none focus:outline-none w-full px-6 border-solid border inline-block mr-3 cursor-text py-4 border-slate-200 focus:border-slate-200 outline-0 placeholder-slate-300 rounded min-h-48 max-h-96 overflow-y-scroll ${
            textSize === 'small' ? 'text-base px-3 py-2' : 'text-lg px-6 py-4'
          } ${
            disabled
              ? 'text-slate-400 cursor-wait'
              : 'text-slate-700 cursor-default'
          }`,
        },
      },
    });
  }, [disabled, editor, textSize]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    // NB: Need this due to weird behavior in tiptap editor.
    // See: https://github.com/ueberdosis/tiptap/issues/4167
    const { from, to } = editor.state.selection;
    editor.commands.setContent(text ?? '', {
      emitUpdate: false,
      parseOptions: { preserveWhitespace: 'full' },
    });
    editor.commands.setTextSelection({ from, to });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <div className="flex flex-col w-full">
      {title ? <div className="pb-4 text-lg font-bold">{title}</div> : null}
      <EditorContent
        editor={editor}
        placeholder={'Do not post content that...'}
        onClick={() => {
          if (!disabled) {
            focusEditor();
          }
        }}
      />
    </div>
  );
}
