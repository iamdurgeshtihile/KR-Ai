import time
import json
import urequests # Standard MicroPython library for HTTP requests
import machine

# --- CONFIGURATION ---
FIREBASE_PROJECT_ID = "krishix-36276"
FIREBASE_URL = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents/hardware_tasks"

# GPIO Pins for ESP32/Pico
PUMP_PIN = 17 
FERT_PIN = 18
pump = machine.Pin(PUMP_PIN, machine.Pin.OUT)
fert = machine.Pin(FERT_PIN, machine.Pin.OUT)

class KrishiClawAgent:
    def __init__(self):
        self.running = True
        print("[KRISHICLAW] Agent Initialized")

    def get_pending_tasks(self):
        try:
            # Query Firestore for status == 'pending'
            # Note: For simplicity in MicroPython, we might just poll the collection 
            # and filter locally if complex queries are hard.
            res = urequests.get(FIREBASE_URL)
            if res.status_code == 200:
                data = res.json()
                tasks = []
                if 'documents' in data:
                    for doc in data['documents']:
                        fields = doc['fields']
                        status = fields['status']['stringValue']
                        if status == 'pending':
                            doc_id = doc['name'].split('/')[-1]
                            tasks.append({
                                'id': doc_id,
                                'type': fields['type']['stringValue'],
                                'params': fields.get('metadata', {}).get('mapValue', {}).get('fields', {})
                            })
                return tasks
            return []
        except Exception as e:
            print(f"[ERROR] Polling failed: {e}")
            return []

    def update_status(self, doc_id, status, progress=0):
        try:
            url = f"{FIREBASE_URL}/{doc_id}?updateMask.fieldPaths=status&updateMask.fieldPaths=progress"
            payload = {
                "fields": {
                    "status": {"stringValue": status},
                    "progress": {"integerValue": str(progress)}
                }
            }
            res = urequests.patch(url, json=payload)
            print(f"[SYNC] Task {doc_id} -> {status}")
            res.close()
        except Exception as e:
            print(f"[ERROR] Sync failed: {e}")

    def execute_skill(self, task_type, params):
        print(f"[SKILL] Executing {task_type}")
        if task_type == 'IRRIGATION':
            pump.on()
            time.sleep(5) # Simulate work
            pump.off()
        elif task_type == 'FERTILIZATION':
            fert.on()
            time.sleep(3)
            fert.off()
        return True

    def run(self):
        while self.running:
            tasks = self.get_pending_tasks()
            for task in tasks:
                print(f"[TASK] New Task: {task['type']}")
                
                # 1. Mark as Executing
                self.update_status(task['id'], 'executing', 10)
                
                # 2. Run Skill
                success = self.execute_skill(task['type'], task['params'])
                
                # 3. Mark as Completed
                if success:
                    self.update_status(task['id'], 'completed', 100)
                else:
                    self.update_status(task['id'], 'failed', 0)
            
            time.sleep(10) # Poll interval

if __name__ == "__main__":
    agent = KrishiClawAgent()
    # agent.run()
