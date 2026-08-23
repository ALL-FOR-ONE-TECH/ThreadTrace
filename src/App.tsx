import React from 'react';
import { SnippetBoard } from './components/SnippetBoard';
import { RetroErrorBoundary } from './components/RetroErrorBoundary';

export const App: React.FC = () => {
  return (
    <RetroErrorBoundary>
      <SnippetBoard />
    </RetroErrorBoundary>
  );
};
