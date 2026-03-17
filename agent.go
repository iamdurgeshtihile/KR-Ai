package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// --- CONFIG ---
const ProjectID = "krishix-36276"
const BaseURL = "https://firestore.googleapis.com/v1/projects/" + ProjectID + "/databases/(default)/documents/hardware_tasks"

type Task struct {
	Name   string `json:"name"`
	Fields struct {
		Type   struct{ StringValue string } `json:"type"`
		Status struct{ StringValue string } `json:"status"`
	} `json:"fields"`
}

type TaskList struct {
	Documents []Task `json:"documents"`
}

// Agent Loop (Based on PicoClaw pkg/agent/loop.go)
func main() {
	fmt.Println("[KRISHICLAW] Go Agent Starting...")

	for {
		tasks, err := pollTasks()
		if err != nil {
			fmt.Printf("[ERROR] Polling failed: %v\n", err)
			time.Sleep(10 * time.Second)
			continue
		}

		for _, task := range tasks {
			docID := getDocID(task.Name)
			fmt.Printf("[TASK] Found pending task: %s\n", task.Fields.Type.StringValue)

			// 1. Update to Executing
			updateStatus(docID, "executing")

			// 2. Execute Skill (GPIO/I2C)
			success := executeSkill(task.Fields.Type.StringValue)

			// 3. Update Final Status
			if success {
				updateStatus(docID, "completed")
			} else {
				updateStatus(docID, "failed")
			}
		}

		time.Sleep(5 * time.Second)
	}
}

func pollTasks() ([]Task, error) {
	resp, err := http.Get(BaseURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var list TaskList
	json.NewDecoder(resp.Body).Decode(&list)

	var pending []Task
	for _, doc := range list.Documents {
		if doc.Fields.Status.StringValue == "pending" {
			pending = append(pending, doc)
		}
	}
	return pending, nil
}

func updateStatus(docID, status string) {
	url := fmt.Sprintf("%s/%s?updateMask.fieldPaths=status", BaseURL, docID)
	payload := map[string]interface{}{
		"fields": map[string]interface{}{
			"status": map[string]interface{}{
				"stringValue": status,
			},
		},
	}
	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest("PATCH", url, bytes.NewBuffer(body))
	http.DefaultClient.Do(req)
	fmt.Printf("[SYNC] %s -> %s\n", docID, status)
}

func executeSkill(taskType string) bool {
	fmt.Printf("[SKILL] Executing %s logic via GPIO...\n", taskType)
	time.Sleep(2 * time.Second)
	return true
}

func getDocID(name string) string {
	// Extract ID from full resource name
	return name[len(BaseURL)-len("hardware_tasks"):] 
}
