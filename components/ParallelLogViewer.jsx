import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackfillLogger from './BackfillLogger';
import MergeLogger from './MergeLogger';
import PrepareLogger from './PrepareLogger';

/**
 * ParallelLogViewer
 *
 * A floating document-icon button (bottom-left, above the logout icon row)
 * that opens a full-screen tabbed log viewer with five tabs:
 *   1. Prepare      — getBackFillDetails calls
 *   2. Backfill Qty — updateBackFillDetails calls
 *   3. BF Complete  — updateBackFillCompleted calls
 *   4. Merge Items  — updateMergedItem calls
 *   5. Merge Status — updateMergeStatus / getMergedBackfills calls
 *
 * Usage: drop <ParallelLogViewer /> into any ParallelPicker screen that
 * already renders absolute-positioned elements (Prepare, Backfill, Merge).
 * It will sit at position: absolute, bottom: 90, left: 15 so it stays clear
 * of the logout icon and the tab bar (hidden in this submodule).
 */

const TABS = [
  { key: 'prepare',        label: 'Prepare' },
  { key: 'backfillQty',   label: 'BF Qty' },
  { key: 'backfillDone',  label: 'BF Done' },
  { key: 'mergeItems',    label: 'Merge Items' },
  { key: 'mergeStatus',   label: 'Merge Status' },
];

async function loadTab(key) {
  switch (key) {
    case 'prepare':
      return PrepareLogger.readCurrentLog();
    case 'backfillQty':
      return BackfillLogger.readQtyLog();
    case 'backfillDone':
      return BackfillLogger.readCompletedLog();
    case 'mergeItems':
      return MergeLogger.readUpdateItemLog();
    case 'mergeStatus': {
      // Combine getMergedBackfills + updateMergeStatus into one view
      const [getResult, statusResult] = await Promise.all([
        MergeLogger.readGetMergedLog(),
        MergeLogger.readMergeStatusLog(),
      ]);
      const separator = '\n' + '─'.repeat(80) + '\n';
      const combined =
        '=== getMergedBackfills ===\n' +
        (getResult.success ? getResult.content : `Error: ${getResult.error}`) +
        separator +
        '=== updateMergeStatus ===\n' +
        (statusResult.success ? statusResult.content : `Error: ${statusResult.error}`);
      return { success: true, content: combined };
    }
    default:
      return { success: false, error: 'Unknown tab' };
  }
}

export default function ParallelLogViewer() {
  const [visible, setVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('prepare');
  const [logContent, setLogContent] = useState('');
  const [loading, setLoading] = useState(false);

  const openViewer = async () => {
    setLoading(true);
    const result = await loadTab(activeTab);
    setLogContent(result.success ? result.content : `Error: ${result.error}`);
    setLoading(false);
    setVisible(true);
  };

  const switchTab = async (key) => {
    setActiveTab(key);
    setLoading(true);
    const result = await loadTab(key);
    setLogContent(result.success ? result.content : `Error: ${result.error}`);
    setLoading(false);
  };

  const refresh = async () => {
    setLoading(true);
    const result = await loadTab(activeTab);
    setLogContent(result.success ? result.content : `Error: ${result.error}`);
    setLoading(false);
  };

  if (!visible) {
    return (
      <TouchableOpacity style={styles.floatButton} onPress={openViewer}>
        {/* Document / log icon using text characters — no image asset required */}
        <Text style={styles.floatIcon}>📋</Text>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.overlay}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Parallel Picker Logs</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={() => setVisible(false)}>
          <Text style={styles.closeBtnText}>Close</Text>
        </TouchableOpacity>
      </View>

      {/* Tab bar — scrollable so all five tabs fit on landscape scanners */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => switchTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Log content */}
      <ScrollView style={styles.logArea}>
        {loading
          ? <Text style={styles.loadingText}>Loading…</Text>
          : <Text style={styles.logText}>{logContent}</Text>
        }
      </ScrollView>

      {/* Refresh button */}
      <TouchableOpacity style={styles.refreshBtn} onPress={refresh}>
        <Text style={styles.refreshBtnText}>Refresh</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  /* ── Floating trigger button ── */
  floatButton: {
    position: 'absolute',
    top: 300,
    right: 15,
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: 'rgba(30,30,30,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    // Sits below the logout icon (top: 25, right: 0) — no overlap
    zIndex: 999,
  },
  floatIcon: {
    fontSize: 24,
  },

  /* ── Full-screen overlay ── */
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    height: 350,
    backgroundColor: '#fff',
    zIndex: 1000,
  },

  /* ── Header ── */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  title: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  closeBtn: {
    backgroundColor: '#d61a1a',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 5,
  },
  closeBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },

  /* ── Tab bar ── */
  tabBar: {
    backgroundColor: '#e0e0e0',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    flexGrow: 0,         // prevent ScrollView from taking all space
  },
  tabBarContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  tab: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    backgroundColor: '#e0e0e0',
  },
  activeTab: {
    backgroundColor: '#1e1e1e',
    borderBottomWidth: 3,
    borderBottomColor: '#00ff00',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
  },
  activeTabText: {
    color: '#00ff00',
  },

  /* ── Log content area ── */
  logArea: {
    flex: 1,
    padding: 10,
    backgroundColor: '#1e1e1e',
  },
  logText: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#00ff00',
    lineHeight: 14,
  },
  loadingText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#aaa',
    marginTop: 20,
    textAlign: 'center',
  },

  /* ── Refresh button ── */
  refreshBtn: {
    backgroundColor: '#007AFF',
    margin: 10,
    padding: 13,
    borderRadius: 5,
    alignItems: 'center',
  },
  refreshBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
