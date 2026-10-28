package com.shubhvela.app.widgets

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters

/** WorkManager periodic job (15 min, plan P4): redraws every placed widget from the state file and re-arms the boundary alarm. */
class WidgetRefreshWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
  override fun doWork(): Result {
    return try {
      WidgetUpdater.updateAll(applicationContext)
      Result.success()
    } catch (e: Exception) {
      // A failed redraw keeps the last bitmap on screen; the next period tries again.
      Result.retry()
    }
  }
}
