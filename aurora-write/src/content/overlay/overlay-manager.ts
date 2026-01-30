import type { TextIssue, AnalysisResult } from '../../shared/types/analysis';
import type { TextFieldInfo } from '../detector/text-field-detector';
import { TextareaHandler } from '../detector/textarea-handler';
import { ContentEditableHandler } from '../detector/contenteditable-handler';
import { UnderlineRenderer } from './underline-renderer';

interface FieldOverlay {
  field: TextFieldInfo;
  container: HTMLElement;
  shadowRoot: ShadowRoot;
  renderer: UnderlineRenderer;
  handler: TextareaHandler | ContentEditableHandler;
  issues: TextIssue[];
}

export class OverlayManager {
  private overlays: Map<string, FieldOverlay> = new Map();
  private onIssueClick: ((issue: TextIssue, fieldId: string) => void) | null = null;

  setOnIssueClick(callback: (issue: TextIssue, fieldId: string) => void): void {
    this.onIssueClick = callback;
  }

  createOverlay(field: TextFieldInfo): void {
    if (this.overlays.has(field.id)) return;

    const container = document.createElement('div');
    container.className = 'aurora-overlay-container';
    container.setAttribute('data-aurora-overlay', field.id);

    const shadowRoot = container.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = `
      :host {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 2147483647;
        overflow: hidden;
      }
      .aurora-underline {
        position: absolute;
        pointer-events: none;
      }
      .aurora-underline-segment {
        pointer-events: auto;
      }
    `;
    shadowRoot.appendChild(style);

    const overlayContent = document.createElement('div');
    overlayContent.className = 'aurora-overlay-content';
    overlayContent.style.cssText = `
      position: relative;
      width: 100%;
      height: 100%;
      pointer-events: none;
    `;
    shadowRoot.appendChild(overlayContent);

    this.positionContainer(container, field.element);

    field.element.parentElement?.insertBefore(container, field.element.nextSibling);

    const handler = field.type === 'contenteditable'
      ? new ContentEditableHandler(field.element as HTMLElement)
      : new TextareaHandler(field.element as HTMLTextAreaElement | HTMLInputElement);

    const renderer = new UnderlineRenderer(overlayContent);

    // Set up click handler for underline segments
    renderer.setOnSegmentClick((issue) => {
      console.log('[AuroraWrite] Renderer segment click callback, issue:', issue.id);
      if (this.onIssueClick) {
        this.onIssueClick(issue, field.id);
      }
    });

    const overlay: FieldOverlay = {
      field,
      container,
      shadowRoot,
      renderer,
      handler,
      issues: [],
    };

    this.setupEventListeners(overlay);
    this.overlays.set(field.id, overlay);
  }

  private positionContainer(container: HTMLElement, element: HTMLElement): void {
    const rect = element.getBoundingClientRect();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    container.style.cssText = `
      position: absolute;
      top: ${rect.top + scrollY}px;
      left: ${rect.left + scrollX}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      pointer-events: none;
      z-index: 2147483647;
    `;
  }

  private setupEventListeners(overlay: FieldOverlay): void {
    const updatePosition = () => {
      this.positionContainer(overlay.container, overlay.field.element);
      this.updateUnderlines(overlay);
    };

    overlay.field.element.addEventListener('scroll', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    // Add click listener to the overlay content inside shadow DOM
    const overlayContent = overlay.shadowRoot.querySelector('.aurora-overlay-content');
    if (overlayContent) {
      overlayContent.addEventListener('click', (e) => {
        console.log('[AuroraWrite] Overlay clicked at', (e as MouseEvent).clientX, (e as MouseEvent).clientY);
        const issue = overlay.renderer.getUnderlineAt((e as MouseEvent).clientX, (e as MouseEvent).clientY);
        console.log('[AuroraWrite] Issue at click:', issue);
        if (issue && this.onIssueClick) {
          e.preventDefault();
          e.stopPropagation();
          this.onIssueClick(issue, overlay.field.id);
        }
      });
    }
  }

  updateAnalysis(fieldId: string, result: AnalysisResult): void {
    const overlay = this.overlays.get(fieldId);
    if (!overlay) return;

    overlay.issues = result.issues;
    this.updateUnderlines(overlay);
  }

  private updateUnderlines(overlay: FieldOverlay): void {
    const text = overlay.handler.getText();

    overlay.renderer.render(overlay.issues, (issue) => {
      const positions = overlay.handler.getTextPositions(text, issue.startOffset, issue.endOffset);
      return positions.rects;
    });
  }

  getIssuesForField(fieldId: string): TextIssue[] {
    return this.overlays.get(fieldId)?.issues || [];
  }

  replaceText(fieldId: string, issue: TextIssue): void {
    const overlay = this.overlays.get(fieldId);
    if (!overlay) return;

    overlay.handler.replaceText(issue.startOffset, issue.endOffset, issue.suggestedText);
  }

  ignoreIssue(fieldId: string, issueId: string): void {
    const overlay = this.overlays.get(fieldId);
    if (!overlay) return;

    const issue = overlay.issues.find((i) => i.id === issueId);
    if (issue) {
      issue.ignored = true;
      this.updateUnderlines(overlay);
    }
  }

  removeOverlay(fieldId: string): void {
    const overlay = this.overlays.get(fieldId);
    if (!overlay) return;

    overlay.renderer.destroy();
    overlay.handler.destroy();
    overlay.container.remove();
    this.overlays.delete(fieldId);
  }

  refreshPositions(): void {
    for (const overlay of this.overlays.values()) {
      this.positionContainer(overlay.container, overlay.field.element);
      this.updateUnderlines(overlay);
    }
  }

  destroy(): void {
    for (const fieldId of this.overlays.keys()) {
      this.removeOverlay(fieldId);
    }
  }
}
