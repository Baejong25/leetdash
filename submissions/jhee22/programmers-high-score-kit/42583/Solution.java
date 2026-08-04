import java.util.*; 
class Solution {
    public int solution(int bridge_length, int weight, int[] truck_weights) {
        // 다리 큐만들기 
        Queue<Integer> queue = new ArrayDeque<>(); 
        
        // 다리 길이 만큼 0을 넣는다 
        for (int i = 0; i < bridge_length; i++){
            queue.offer(0); 
        }
        
        // 상태변수 선언 
        int time = 0; 
        int curr_w = 0; 
        int idx = 0; 
        
        // 모든 트럭이 다리에 들어가지 않으면 반복
        while (idx < truck_weights.length) {
           // 시간 증가
            time++; 
            
            // 다리의 맨 앞 값을 제거 
            int outTruck = queue.poll(); 
            curr_w -= outTruck;
            
            // 다음 트럭이 다리에 들어갈 수 있는가? 
            if (curr_w + truck_weights[idx] <= weight) {
                // 큐에 다음 트럭의 무게를 넣기 
                queue.offer(truck_weights[idx]); 
                curr_w += truck_weights[idx]; 
                idx++; 
            } else {
                queue.offer(0);
            } 
        } 
        return time + bridge_length;
        
        
    }
}