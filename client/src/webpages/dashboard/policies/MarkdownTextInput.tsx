import { Editor, EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useMemo, useRef } from 'react';

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
      extensions: [
        StarterKit.configure({
          bulletList: {
            keepMarks: true,
            keepAttributes: false, // TODO : Making this as `false` becase marks are not preserved when I try to preserve attrs, awaiting a bit of help
          },
          orderedList: {
            keepMarks: true,
            keepAttributes: false, // TODO : Making this as `false` becase marks are not preserved when I try to preserve attrs, awaiting a bit of help
          },
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
  editorRef.current = editor;
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
    editor.commands.setContent(text ?? '', false, {
      preserveWhitespace: 'full',
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
