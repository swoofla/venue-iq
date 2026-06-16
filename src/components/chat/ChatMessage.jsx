import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Chat-friendly markdown components. Headings are downgraded to bold inline text
// so nothing in a bubble looks like a report header. No tables.
const boldText = ({ children }) => (
  <span className="font-semibold">{children}</span>
);

const markdownComponents = {
  p: ({ children }) => <p style={{ margin: '0 0 6px 0' }}>{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul style={{ margin: '4px 0', paddingLeft: '18px', listStyleType: 'disc' }}>
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol style={{ margin: '4px 0', paddingLeft: '18px', listStyleType: 'decimal' }}>
      {children}
    </ol>
  ),
  li: ({ children }) => <li style={{ margin: '2px 0' }}>{children}</li>,
  h1: boldText,
  h2: boldText,
  h3: boldText,
  h4: boldText,
  h5: boldText,
  h6: boldText,
};

export default function ChatMessage({ message, isBot }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex ${isBot ? 'justify-start' : 'justify-end'} mb-4`}
    >
      {isBot && (
        <div
          className="rounded-full bg-stone-100 flex items-center justify-center mr-2 flex-shrink-0"
          style={{ width: '26px', height: '26px' }}
        >
          <Sparkles style={{ width: '13px', height: '13px' }} className="text-stone-600" />
        </div>
      )}
      <div
        className={`max-w-[75%] ${
          isBot ? 'bg-stone-50 text-stone-900 border border-stone-200' : 'bg-black text-white'
        }`}
        style={{
          padding: '9px 13px',
          fontSize: '13px',
          lineHeight: 1.45,
          borderRadius: isBot ? '16px 16px 16px 4px' : '16px 16px 4px 16px',
          borderWidth: isBot ? '0.5px' : 0,
        }}
      >
        {isBot ? (
          <div className="chat-markdown" style={{ margin: 0 }}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {message || ''}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="whitespace-pre-wrap" style={{ margin: 0 }}>{message}</p>
        )}
      </div>
    </motion.div>
  );
}