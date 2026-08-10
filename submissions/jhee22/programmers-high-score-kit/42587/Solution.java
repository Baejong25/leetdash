import java.util.*; 
class Solution {
    public int solution(int[] priorities, int location) {
        Queue <int[]> queue = new ArrayDeque<>(); 
        for (int i = 0; i < priorities.length; i++){
            queue.offer(new int[] {priorities[i], i});
        }
        
        int cnt = 0; 
        while (!queue.isEmpty()){
            boolean flag = true; 
            int[] curr = queue.poll(); 
            int curr_pri = curr[0]; 
            int curr_idx = curr[1]; 
            
            for (int[] job : queue) {
                if (curr_pri < job[0]) {
                    flag = false; 
                    break; 
                }
            }
            
            if (!flag) {
                queue.offer(curr);
            } else {
                cnt++; 
                if (curr_idx == location){
                    return cnt; 
                }
            } 
            
        }
        return -1; 
    }
}