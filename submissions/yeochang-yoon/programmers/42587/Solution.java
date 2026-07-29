import java.util.*;

class Solution {
    public int solution(int[] priorities, int location) {

        PriorityQueue<Integer> pq = new PriorityQueue<>(Comparator.reverseOrder());

        Queue<Integer> index = new ArrayDeque<>();

        for(int i = 0; i < priorities.length; i++){
            pq.offer(priorities[i]);
            index.offer(i);
        }

        int count = 0;
        while(!index.isEmpty()){
            int n = index.poll();
            if(priorities[n] == pq.peek()){
                count++;
                pq.poll();
                if(n == location){
                    return count;
                }
            }else{
                index.offer(n);
            }
        }
        return count;

    }
}