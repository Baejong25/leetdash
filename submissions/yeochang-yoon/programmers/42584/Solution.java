import java.util.*;

class Solution {
    public int[] solution(int[] prices) {

        Deque<Integer> stack = new ArrayDeque<>();

        stack.push(0);

        int[] time = new int[prices.length];
        time[prices.length-1] = 0;

        for(int i = 1; i < prices.length-1; i++){
            while(!stack.isEmpty() && prices[stack.peek()] > prices[i]){
                int idx = stack.pop();
                time[idx] = i - idx;
            }
            stack.push(i);
        }

        while(!stack.isEmpty()){
            int idx = stack.pop();
            time[idx] = prices.length-1 - idx;
        }




        return time;
    }
}