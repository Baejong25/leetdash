import java.util.*;

// 1 <= temperatures.length <= 105
// 30 <= temperatures[i] <= 100

class Solution {
    public int[] dailyTemperatures(int[] temperatures) {
        ArrayDeque<Integer> deque = new ArrayDeque<>();
        int[] answer = new int[temperatures.length];
        int c = 1;
        for (int i = 0 ; i < temperatures.length; i++) {
            if (deque.isEmpty()) {
                deque.push(i);
                continue;
            }

            // 현재 온도가 스택에 있는 이전날짜의 온도들보다 높다면
            while (!deque.isEmpty() && temperatures[i] > temperatures[deque.peekLast()]) {
                int v = deque.pollLast();
                answer[v] = i - v;
            }

            deque.add(i);
        }
        return answer;
    }
}
