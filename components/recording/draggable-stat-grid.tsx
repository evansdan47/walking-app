import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';

const COLS = 2;

export interface StatPanel {
  key: string;
  node: ReactNode;
  /** Optional tap handler (e.g. info popup). Long-press always starts drag. */
  onPress?: () => void;
  /** If true, the panel spans the full grid width instead of a half-column. */
  fullWidth?: boolean;
}

interface Props {
  panels: StatPanel[];
  /** Ordered list of panel keys from preferences. */
  order: string[];
  onReorder: (keys: string[]) => void;
}

export function DraggableStatGrid({ panels, order, onReorder }: Props) {
  const panelByKey = new Map(panels.map((p) => [p.key, p]));

  const [liveOrder, setLiveOrder] = useState<string[]>(order);
  const [dragKey, setDragKey] = useState<string | null>(null);

  const liveOrderRef = useRef(liveOrder);
  const isDragging = useRef(false);
  const dragKeyRef = useRef<string | null>(null);

  const containerRef = useRef<View>(null);
  const containerPageX = useRef(0);
  const containerPageY = useRef(0);
  const itemWidth = useRef(0);
  const itemHeight = useRef(0);

  // Sync with parent when not dragging
  useEffect(() => {
    if (!isDragging.current) {
      liveOrderRef.current = order;
      setLiveOrder(order);
    }
  }, [order]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: () => false,
      // Capture moves once drag is active, overriding the scroll view
      onMoveShouldSetPanResponderCapture: () => isDragging.current,

      onPanResponderMove: (evt) => {
        const key = dragKeyRef.current;
        if (!key) return;

        const { pageX, pageY } = evt.nativeEvent;
        const relX = pageX - containerPageX.current;
        const relY = pageY - containerPageY.current;

        const cellW = itemWidth.current + Spacing.sm;
        const cellH = itemHeight.current + Spacing.sm;

        const col = Math.max(0, Math.min(COLS - 1, Math.floor(relX / cellW)));
        const maxRow = Math.ceil(liveOrderRef.current.length / COLS) - 1;
        const row = Math.max(0, Math.min(maxRow, Math.floor(relY / cellH)));
        const targetIdx = Math.min(row * COLS + col, liveOrderRef.current.length - 1);

        const fromIdx = liveOrderRef.current.indexOf(key);
        if (fromIdx !== -1 && fromIdx !== targetIdx) {
          const newOrder = [...liveOrderRef.current];
          newOrder.splice(fromIdx, 1);
          newOrder.splice(targetIdx, 0, key);
          liveOrderRef.current = newOrder;
          setLiveOrder(newOrder);
        }
      },

      onPanResponderRelease: () => {
        isDragging.current = false;
        dragKeyRef.current = null;
        setDragKey(null);
        onReorder([...liveOrderRef.current]);
      },

      onPanResponderTerminate: () => {
        isDragging.current = false;
        dragKeyRef.current = null;
        setDragKey(null);
      },
    }),
  ).current;

  return (
    <View ref={containerRef} style={styles.grid} {...panResponder.panHandlers}>
      {liveOrder.map((key, idx) => {
        const panel = panelByKey.get(key);
        if (!panel) return null;
        const isActive = dragKey === key;

        return (
          <View
            key={key}
            style={[styles.item, panel.fullWidth && styles.itemFull]}
            onLayout={
              idx === 0
                ? (e) => {
                    itemWidth.current = e.nativeEvent.layout.width;
                    itemHeight.current = e.nativeEvent.layout.height;
                  }
                : undefined
            }
          >
            <Pressable
              onPress={panel.onPress}
              onLongPress={() => {
                containerRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
                  containerPageX.current = pageX;
                  containerPageY.current = pageY;
                });
                isDragging.current = true;
                dragKeyRef.current = key;
                setDragKey(key);
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }}
              delayLongPress={450}
              style={[styles.pressable, isActive && styles.pressableActive]}
            >
              {panel.node}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  item: {
    flexBasis: '48%',
    flex: 1,
  },
  itemFull: {
    flexBasis: '100%',
    flex: 1,
  },
  pressable: {
    flex: 1,
  },
  pressableActive: {
    opacity: 0.55,
    transform: [{ scale: 1.04 }],
  },
});
