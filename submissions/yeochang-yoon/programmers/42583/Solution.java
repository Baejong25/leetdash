import java.util.*;

class Solution {
    public int solution(int bridge_length, int weight, int[] truck_weights) {

        int curWeight = 0;

        Queue<Integer> queue = new ArrayDeque<>();

        for(int i = 0; i < bridge_length; i++){
            queue.offer(0);
        }

        int time = 0;
        int idx = 0;

        while(idx < truck_weights.length){
            int a = queue.poll();
            if(a != 0){
                curWeight -= a;
            }
            if(curWeight + truck_weights[idx] <= weight){
                queue.offer(truck_weights[idx]);
                curWeight += truck_weights[idx];
                idx++;
            } else{
                queue.offer(0);
            }
            time++;
        }

        int answer = time + bridge_length;

        return answer;
    }
}